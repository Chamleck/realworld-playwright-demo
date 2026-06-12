import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { AgentTool } from '../core/types';

/**
 * Resolves a project-relative path and validates it stays within the
 * project root. Returns null if the resolved path escapes the root.
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