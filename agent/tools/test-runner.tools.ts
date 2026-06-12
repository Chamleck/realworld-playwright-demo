import { execSync } from 'node:child_process';
import type { AgentTool } from '../core/types';

export const runPlaywrightTestTool: AgentTool = {
  name: 'run_playwright_test',
  description:
    'Run Playwright tests and return the output. Primarily used to re-run ' +
    'a specific failing test after proposing a fix, to verify it passes. ' +
    'Accepts any valid "npx playwright test" arguments.',
  input_schema: {
    type: 'object',
    properties: {
      args: {
        type: 'string',
        description:
          'Arguments passed to "npx playwright test". ' +
          'Examples: "tests/e2e/auth.spec.ts", "--grep @smoke --project=chromium"',
      },
    },
    required: ['args'],
  },
  execute: async (input) => {
    try {
      /*
       * 2>&1 merges stderr into stdout — Playwright writes test output to
       * stderr, so without this merge the agent would receive an empty
       * string and miss all failure details.
       */
      return execSync(`npx playwright test ${input.args as string} 2>&1`, {
        cwd: process.cwd(),
        encoding: 'utf-8',
        timeout: 120_000, /* 2 min hard cap — prevents hung browser processes */
        maxBuffer: 5 * 1024 * 1024,
      });
    } catch (err: unknown) {
      /*
       * execSync throws on non-zero exit code — test failures are expected
       * and their stdout still contains the full failure output we need.
       */
      if (err && typeof err === 'object' && 'stdout' in err) {
        return (err as { stdout: string }).stdout;
      }
      return `Error running tests: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};