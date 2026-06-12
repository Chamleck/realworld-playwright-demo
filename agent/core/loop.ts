import { GoogleGenerativeAI, type FunctionDeclaration, type Part } from '@google/generative-ai';
import type { AgentConfig, AgentResult, AgentStep } from './types';
import { AgentLogger } from './logger';

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
  userMessage: string
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
  let response = await chat.sendMessage(userMessage);

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
    response = await chat.sendMessage(functionResponses);
  }

  /* Fallback — max iterations reached */
  return {
    completed: false,
    response: `Agent reached maximum iterations (${config.maxIterations}) without completing the task.`,
    steps: logger.getSteps(),
    iterationsUsed: iteration,
  };
}