/*
 * Tool registry — barrel export for all agent tools.
 *
 * Agents import only what they need, keeping each agent's tool surface
 * minimal. Unused tools waste context window tokens because Gemini
 * receives all tool schemas on every API call.
 *
 * closeBrowser is exported here for convenience but is not a tool —
 * it's a lifecycle function called from the CLI after the agent run.
 */
export { readFileTool, listFilesTool, writeFileTool } from './filesystem.tools';
export { runPlaywrightTestTool } from './test-runner.tools';
export {
  navigateToPageTool,
  getInteractiveElementsTool,
  closeBrowser,
} from './playwright.tools';