import type { AgentConfig } from '../core/types';
import { ANALYST_SYSTEM_PROMPT } from '../prompts/analyst.system';
import { readFileTool, listFilesTool, runPlaywrightTestTool } from '../tools/index';

/**
 * Failure Analyst agent configuration.
 *
 * Tool selection rationale:
 * - readFileTool       — reads reports, spec files, and Page Objects for analysis
 * - listFilesTool      — discovers project structure when file paths are unknown
 * - runPlaywrightTestTool — re-runs a specific test to verify a proposed fix
 *
 * Why maxIterations = 8:
 * Typical analysis flow: read report(1) + read spec(1) + read PO(1) + conclude(1) = 4.
 * Budget of 8 covers multiple failures or cases where the agent needs extra
 * context (e.g. reads helpers or fixtures to understand a data-related failure).
 */
export const analystAgent: AgentConfig = {
  name: 'failure-analyst',
  systemPrompt: ANALYST_SYSTEM_PROMPT,
  tools: [readFileTool, listFilesTool, runPlaywrightTestTool],
  maxIterations: 8,
  model: 'gemini-2.5-flash-lite',
};