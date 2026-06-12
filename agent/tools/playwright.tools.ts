import { chromium, type Browser, type Page } from 'playwright';
import type { AgentTool } from '../core/types';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
/*
 * Path to the storageState created by globalSetup.ts before each test run.
 * Contains the pre-seeded user's (jake@jake.jake) JWT token injected into
 * localStorage — allows the agent's browser to access authenticated pages
 * without manually navigating through the login flow.
 */
const STORAGE_STATE_PATH = path.resolve(
  process.cwd(),
  'tests/auth/.storage-state.json',
);

/*
 * Module-level browser singleton — reused across all tool calls within
 * one agent run. Creating a new browser per tool call would be extremely
 * slow (~1s per launch) and wasteful when navigating the same session
 * multiple times.
 *
 * Why module-level and not passed as argument:
 * Tools are plain async functions with a fixed signature (input → string).
 * Injecting browser state via closure is the only clean option without
 * changing the AgentTool interface.
 *
 * Call closeBrowser() from the CLI after runAgent() completes — without
 * it the Node.js process hangs indefinitely waiting for the browser.
 */
let browser: Browser | null = null;
let page: Page | null = null;

async function ensureBrowser(): Promise<Page> {
  if (!browser) browser = await chromium.launch({ headless: true });

  if (!page || page.isClosed()) {
    /*
     * Use storageState if available — silently fall back to anonymous context
     * if the file doesn't exist (e.g. globalSetup hasn't been run yet).
     * This lets the agent access authenticated pages like /settings without
     * a manual login flow.
     */
    const hasStorageState = await fs.access(STORAGE_STATE_PATH)
      .then(() => true)
      .catch(() => false);

    const context = await browser.newContext(
      hasStorageState ? { storageState: STORAGE_STATE_PATH } : {},
    );
    page = await context.newPage();
  }

  return page;
}
/**
 * Releases the browser process after the agent run completes.
 * Not a tool — called directly from the CLI entry point (agent/index.ts).
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
  }
}

export const navigateToPageTool: AgentTool = {
  name: 'navigate_to_page',
  description:
    'Navigate to a URL and return the page title and final URL. ' +
    'Use as the first step when analyzing a new page.',
  input_schema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'Full URL (e.g. "http://localhost:3000/login")',
      },
    },
    required: ['url'],
  },
  execute: async (input) => {
    const p = await ensureBrowser();
    try {
      await p.goto(input.url as string, { waitUntil: 'networkidle' });
      return JSON.stringify({ title: await p.title(), url: p.url() });
    } catch (err) {
      return `Error navigating: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};

export const getInteractiveElementsTool: AgentTool = {
  name: 'get_interactive_elements',
  description:
    'Return all interactive elements on the current page: inputs, buttons, ' +
    'links, selects. Each element includes tag, type, accessible name, ' +
    'placeholder, testId, and href. Use after navigate_to_page to understand ' +
    'page structure before generating Page Objects.',
  input_schema: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: async () => {
    const p = await ensureBrowser();
    try {
      const elements = await p.evaluate(() => {
        const nodes = document.querySelectorAll(
          'input, button, a[href], select, textarea, [role="button"], [role="link"], [role="tab"]',
        );
        return Array.from(nodes).map((el) => ({
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute('type') ?? null,
          role: el.getAttribute('role') ?? null,
          /*
           * Accessible name drives getByRole/getByLabel selectors —
           * the most important field for generating reliable locators.
           */
          name: el.getAttribute('aria-label')
            ?? el.textContent?.trim().slice(0, 80)
            ?? null,
          placeholder: el.getAttribute('placeholder') ?? null,
          testId: el.getAttribute('data-testid') ?? null,
          href: el.tagName === 'A' ? el.getAttribute('href') : null,
        }));
      });
      return JSON.stringify(elements, null, 2);
    } catch (err) {
      return `Error getting elements: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};