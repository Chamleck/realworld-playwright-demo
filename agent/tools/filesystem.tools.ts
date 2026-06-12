import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { AgentTool } from '../core/types';

/**
 * Resolves a project-relative path and guards against traversal outside
 * the project root. Returns null if the path escapes the root.
 *
 * Why this guard exists:
 * The agent constructs file paths autonomously based on LLM reasoning.
 * Without this check, a hallucinated path like "../../etc/passwd" would
 * resolve outside the project. Rejecting it at the tool level means the
 * agent receives a clear error string rather than a silent security hole.
 */
function safeResolve(relativePath: string): string | null {
  const resolved = path.resolve(process.cwd(), relativePath);
  return resolved.startsWith(process.cwd()) ? resolved : null;
}

export const readFileTool: AgentTool = {
  name: 'read_file',
  description:
    'Read the contents of a file. Use for test source code, Page Objects, ' +
    'fixture files, config files, or Playwright JSON reports.',
  input_schema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path relative to project root (e.g. "tests/e2e/auth.spec.ts")',
      },
    },
    required: ['filePath'],
  },
  execute: async (input) => {
    const resolved = safeResolve(input.filePath as string);
    if (!resolved) return 'Error: path traversal outside project root is not allowed';

    try {
      return await fs.readFile(resolved, 'utf-8');
    } catch (err) {
      /*
       * Return errors as strings rather than throwing — the agent receives
       * all tool results as text and can reason about the error message
       * (e.g. "file not found" tells it to try a different path).
       */
      return `Error reading file: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};

export const listFilesTool: AgentTool = {
  name: 'list_files',
  description:
    'List files and directories at a given path. Use to discover project ' +
    'structure, locate spec files, Page Objects, or fixture files.',
  input_schema: {
    type: 'object',
    properties: {
      dirPath: {
        type: 'string',
        description: 'Directory path relative to project root (e.g. "tests/pages")',
      },
    },
    required: ['dirPath'],
  },
  execute: async (input) => {
    const resolved = safeResolve(input.dirPath as string);
    if (!resolved) return 'Error: path traversal outside project root is not allowed';

    try {
      const entries = await fs.readdir(resolved, { withFileTypes: true });
      /*
       * Prefix directories with 📁 and files with 📄 so the agent can
       * distinguish them without a separate stat() call per entry.
       */
      return entries
        .map((e) => `${e.isDirectory() ? '📁' : '📄'} ${e.name}`)
        .join('\n');
    } catch (err) {
      return `Error listing directory: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};

export const writeFileTool: AgentTool = {
  name: 'write_file',
  description:
    'Write content to a file. Creates the file and any missing parent directories. ' +
    'Use for generating Page Objects (tests/pages/) and spec files (tests/e2e/). ' +
    'IMPORTANT: follow project conventions — import test/expect from ' +
    '"tests/fixtures/test-fixtures", extend BasePage, use getByRole/getByLabel selectors.',
  input_schema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path relative to project root (e.g. "tests/pages/SettingsPage.ts")',
      },
      content: {
        type: 'string',
        description: 'Full file content to write',
      },
    },
    required: ['filePath', 'content'],
  },
  execute: async (input) => {
    const resolved = safeResolve(input.filePath as string);
    if (!resolved) return 'Error: path traversal outside project root is not allowed';

    /*
     * Restrict writes to tests/ and agent/ only — prevents the agent from
     * accidentally modifying application source (src/), database (prisma/),
     * or configuration files at the project root.
     */
    const relative = path.relative(process.cwd(), resolved);
    if (!relative.startsWith('tests') && !relative.startsWith('agent')) {
      return 'Error: write access restricted to tests/ and agent/ directories only';
    }

    try {
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, input.content as string, 'utf-8');
      return `Written: ${relative} (${(input.content as string).length} chars)`;
    } catch (err) {
      return `Error writing file: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};