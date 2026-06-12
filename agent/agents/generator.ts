import type { AgentConfig } from '../core/types';
import { GENERATOR_SYSTEM_PROMPT } from '../prompts/generator.system';
import {
  readFileTool,
  listFilesTool,
  writeFileTool,
  runPlaywrightTestTool,
  navigateToPageTool,
  getInteractiveElementsTool,
} from '../tools/index';

/**
 * Test Generator agent configuration.
 *
 * Tool selection rationale:
 * - navigateToPageTool        — opens the target page in a real browser
 * - getInteractiveElementsTool — extracts elements for locator generation
 * - readFileTool              — reads existing patterns before generating
 * - listFilesTool             — discovers what Page Objects already exist
 * - writeFileTool             — writes generated Page Object and spec files
 * - runPlaywrightTestTool     — runs the test and verifies it passes
 *
 * Why maxIterations = 15:
 * Typical flow: navigate(1) + getElements(1) + listFiles(1) + readFile×2(2)
 * + write×2(2) + runTest(1) = 8 baseline. Budget of 15 covers up to 3
 * retry cycles (read error + fix file + run test = 3 iterations each).
 */
export const generatorAgent: AgentConfig = {
  name: 'test-generator',
  systemPrompt: GENERATOR_SYSTEM_PROMPT,
  tools: [
    navigateToPageTool,
    getInteractiveElementsTool,
    readFileTool,
    listFilesTool,
    writeFileTool,
    runPlaywrightTestTool,
  ],
  maxIterations: 15,
  model: 'gemini-2.5-flash-lite',
  iterationDelayMs: 7000, /* 7s between iterations → ~8 RPM, safely under 10 RPM limit */
};