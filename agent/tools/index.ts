/*
 * Tool registry — barrel export for all agent tools.
 *
 * Agents import only what they need from here, keeping each agent's
 * tool surface minimal. Unused tools waste context window tokens
 * because Claude/Gemini receives all tool schemas on every API call.
 */
export { readFileTool, listFilesTool } from './filesystem.tools';
export { runPlaywrightTestTool } from './test-runner.tools';

/*
 * Phase 2 will add:
 * export { navigateToPageTool, getInteractiveElementsTool } from './playwright.tools';
 * export { writeFileTool } from './filesystem.tools';
 */