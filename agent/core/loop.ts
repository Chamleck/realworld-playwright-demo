import { GoogleGenerativeAI, type FunctionDeclaration, type Part } from '@google/generative-ai';
import type { AgentConfig, AgentResult, AgentStep } from './types';
import { AgentLogger } from './logger';

/**
 * Retries an async operation with exponential backoff.
 *
 * Why this exists:
 * Gemini API returns 503 (overload) and 429 (rate limit) as transient errors
 * that resolve on retry. Without this, a single spike in API demand aborts
 * the entire agent run and loses all accumulated context. Exponential backoff
 * (2s → 4s → 6s) avoids hammering the API during a degraded period.
 *
 * Only retries on transient HTTP errors — non-transient errors (auth, bad
 * request, etc.) are rethrown immediately on the first attempt.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelayMs = 2000,
): Promise<T> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;

      const message = err instanceof Error ? err.message : String(err);

      /*
       * 429 = quota exhausted — retrying won't help until the window resets
       * (minutes to hours). Fail fast with a clear message instead of
       * waiting and retrying, which wastes time and remaining quota.
       */
      if (message.includes('429')) throw err;

      /*
       * 503 = server temporarily overloaded — worth retrying with backoff.
       */
      if (!message.includes('503') || attempt === retries) throw err;

      const delay = baseDelayMs * attempt;
      console.log(`\n⚠️  API unavailable (attempt ${attempt}/${retries}), retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastErr;
}

/**
 * Core ReAct (Reason + Act) loop shared by all agents.
 *
 * Gemini maintains conversation history internally via the chat object —
 * no manual message array management needed unlike the Anthropic API.
 *
 * Flow per iteration:
 *   1. Check response parts for function calls
 *   2. No function calls  → agent is done, return final text
 *   3. Function calls     → execute each, send results back, repeat
 *   4. maxIterations hit  → exit cleanly with completed: false
 */
export async function runAgent(
  config: AgentConfig,
  userMessage: string,
): Promise<AgentResult> {
  /*
   * Client is instantiated here (not at module level) so that dotenv
   * has already populated process.env by the time the API key is read.
   */
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY ?? '');
  const logger = new AgentLogger();

  console.log(`\n🤖 Agent "${config.name}" starting...`);
  console.log(`📝 Task: ${userMessage.slice(0, 100)}...\n`);

  const model = genAI.getGenerativeModel({
    model: config.model,
    systemInstruction: config.systemPrompt,
    /*
     * thinkingBudget: -1 enables dynamic thinking — the model allocates
     * reasoning tokens based on task complexity. Simple tasks get fast
     * responses; complex multi-step reasoning gets deeper analysis.
     * Ideal for agent tasks where complexity varies per iteration.
     */
    generationConfig: {
      thinkingConfig: {
        thinkingBudget: -1,
      },
    } as object, // thinkingConfig not yet typed in @google/generative-ai, cast required
    /*
     * Pass tools only when the agent has them — sending an empty
     * functionDeclarations array causes a Gemini API validation error.
     */
    tools: config.tools.length > 0
      ? [{ functionDeclarations: config.tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        } as FunctionDeclaration)) }]
      : undefined,
  });

  /* Fast lookup from tool name → implementation at call time */
  const executors = new Map(config.tools.map((t) => [t.name, t.execute]));

  /*
   * Gemini's chat object maintains conversation history internally.
   * We send the initial message here and pass subsequent tool results
   * via sendMessage() on each iteration.
   */
  const chat = model.startChat();
  let response = await withRetry(() => chat.sendMessage(userMessage));

  let iteration = 0;

  while (iteration < config.maxIterations) {
    const parts = response.response.candidates?.[0]?.content?.parts ?? [];
    const functionCalls = parts.filter((p) => p.functionCall);

    /*
     * Gemini has no explicit stop_reason — completion is inferred by the
     * absence of functionCall parts. If the model has no tools to call,
     * it returns only text parts, which signals the task is done.
     */
    if (functionCalls.length === 0) {
      return {
        completed: true,
        response: response.response.text(),
        steps: logger.getSteps(),
        iterationsUsed: iteration,
      };
    }

    iteration++;
    console.log(`\n--- Iteration ${iteration}/${config.maxIterations} ---`);

    /* Execute every requested tool call and collect results */
    const functionResponses: Part[] = [];

    for (const part of functionCalls) {
      if (!part.functionCall) continue;

      const { name, args } = part.functionCall;
      const executor = executors.get(name);
      let result: string;

      if (!executor) {
        result = `Error: unknown tool "${name}"`;
      } else {
        try {
          result = await executor(args as Record<string, unknown>);
        } catch (err) {
          result = `Error: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      const step: AgentStep = {
        iteration,
        toolName: name,
        toolInput: args as Record<string, unknown>,
        result,
        timestamp: new Date().toISOString(),
      };
      logger.logStep(step);

      /* Gemini expects tool results wrapped in functionResponse parts */
      functionResponses.push({
        functionResponse: { name, response: { result } },
      });
    }

    /* Send all tool results in one message — Gemini processes them together */
    response = await withRetry(() => chat.sendMessage(functionResponses));

    /*
     * Optional delay between iterations — prevents hitting free-tier RPM limits.
     * gemini-2.5-flash-lite has a 10 RPM limit; 7s between iterations keeps
     * throughput at ~8 RPM, safely within the limit.
     * Set iterationDelayMs in AgentConfig to enable. Omit for paid-tier models.
     */
    if (config.iterationDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, config.iterationDelayMs));
    }
  }

  /* Fallback — max iterations reached */
  return {
    completed: false,
    response: `Agent reached maximum iterations (${config.maxIterations}) without completing the task.`,
    steps: logger.getSteps(),
    iterationsUsed: iteration,
  };
}