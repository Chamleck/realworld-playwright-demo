/**
 * Generic JSON Schema for tool input parameters.
 * Provider-agnostic — works with both Gemini and any other LLM that
 * follows the standard JSON Schema function calling convention.
 */
export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description: string;
    enum?: string[];
  }>;
  required?: string[];
}

/**
 * A single tool the agent can call during its ReAct loop.
 *
 * Why execute returns string:
 * All LLMs receive tool results as text — structured data (JSON, stack
 * traces, file contents) is stringified before being appended to the
 * conversation. Keeping the contract simple avoids unnecessary
 * serialization logic in the loop.
 */
export interface AgentTool {
  name: string;
  description: string;
  input_schema: ToolInputSchema;
  execute: (input: Record<string, unknown>) => Promise<string>;
}

/**
 * Agent configuration — the only thing that differs between agents.
 * The ReAct loop in loop.ts is shared; behaviour is driven entirely
 * by systemPrompt, the available tools, and iteration limits.
 */
export interface AgentConfig {
  name: string;
  systemPrompt: string;
  tools: AgentTool[];
  maxIterations: number;
  model: string;
}

/** Immutable record of a single tool call within one agent run */
export interface AgentStep {
  iteration: number;
  toolName: string;
  toolInput: Record<string, unknown>;
  result: string;
  timestamp: string;
}

/** Final output of a completed (or exhausted) agent run */
export interface AgentResult {
  /** false when maxIterations was reached without a final text response */
  completed: boolean;
  response: string;
  steps: AgentStep[];
  iterationsUsed: number;
}