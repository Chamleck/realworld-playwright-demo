import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as readline from 'node:readline/promises';
import * as dotenv from 'dotenv';
import { runAgent } from './core/loop';
import { analystAgent } from './agents/analyst';
import { generatorAgent } from './agents/generator';
import { closeBrowser } from './tools/index';
import type { AgentStep } from './core/types';

/*
 * CLI entry point for the AI agent module.
 *
 * Two modes:
 *
 *   --analyze [report-path]
 *     Reads a Playwright JSON report, identifies failures, reads source files,
 *     classifies each failure, and suggests specific fixes.
 *     Default report path: test-results/report.json
 *     Example: npm run agent:analyze
 *     Example: npm run agent:analyze test-results/report.json
 *
 *   --generate <url>
 *     Opens the given URL in a headless browser, inspects interactive elements,
 *     studies existing project patterns, and generates a Page Object + spec file.
 *     The app must be running locally for localhost URLs (npm run dev).
 *     After generation you are prompted to keep / rewrite / delete the files.
 *     Example: npm run agent:generate http://localhost:3000/settings
 */

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const mode = process.argv[2];
const target = process.argv[3];

if (!mode || !['--analyze', '--generate'].includes(mode)) {
  console.log('Usage:');
  console.log('  npm run agent:analyze [report-path]');
  console.log('  npm run agent:generate <url>');
  process.exit(1);
}

/**
 * Extracts the paths of every file written during an agent run.
 *
 * Why scan result.steps instead of tracking state in a module-level variable:
 * result.steps is already an immutable audit log of everything the agent did.
 * Using it as the source of truth avoids introducing shared mutable state and
 * means this function works correctly even if the agent writes files across
 * multiple iterations or retries.
 */
function getWrittenFiles(steps: AgentStep[]): string[] {
  return steps
    .filter((s) => s.toolName === 'write_file')
    .map((s) => s.toolInput.filePath as string);
}

/**
 * Deletes all files that the agent wrote during a generator run.
 * Used when the user chooses rewrite or delete after reviewing output.
 *
 * Why .catch(() => {}):
 * A file may not exist if the agent's write_file call failed partway through.
 * Silently skipping missing files is correct — there is nothing to delete.
 */
async function deleteGeneratedFiles(filePaths: string[]): Promise<void> {
  for (const filePath of filePaths) {
    const resolved = path.resolve(process.cwd(), filePath);
    await fs.unlink(resolved).catch(() => {});
  }
}

/**
 * Blocks until the user enters a valid decision character.
 *
 * Why a single shared rl instance instead of creating one per call:
 * readline interfaces hold open stdin. Creating multiple instances can cause
 * "readline was already closed" errors on the second prompt in the rewrite loop.
 */
async function askDecision(
  rl: readline.Interface,
): Promise<'keep' | 'rewrite' | 'delete'> {
  console.log('\nOptions:');
  console.log('  k — keep files as-is');
  console.log('  r — delete and rewrite (agent runs again from scratch)');
  console.log('  d — delete all generated files and exit');

  while (true) {
    const answer = (await rl.question('\nChoice [k / r / d]: ')).trim().toLowerCase();
    if (answer === 'k') return 'keep';
    if (answer === 'r') return 'rewrite';
    if (answer === 'd') return 'delete';
    console.log('  Enter k, r, or d.');
  }
}

async function runAnalyze(): Promise<void> {
  /*
   * Default path matches the JSON reporter output configured in playwright.config.ts.
   * Can be overridden by passing a path as the third CLI argument.
   */
  const reportPath = target ?? 'test-results/report.json';
  console.log(`\n🔍 Analyzing: ${reportPath}\n`);

  const result = await runAgent(
    analystAgent,
    `Analyze the Playwright test report at "${reportPath}". ` +
    `Read it, identify all failures, read the relevant source files, ` +
    `classify each failure, and suggest specific fixes.`,
  );

  console.log('\n' + '='.repeat(60));
  console.log(result.completed ? '✅ Analysis complete' : '⚠️  Reached max iterations');
  console.log(`Iterations used: ${result.iterationsUsed}`);
  console.log('='.repeat(60));
  console.log('\n' + result.response);
}

async function runGenerate(url: string): Promise<void> {
  /*
   * Single readline instance shared across all prompts in this function.
   * Closed explicitly in the finally block to release stdin regardless of
   * whether the loop exits normally or throws.
   */
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    while (true) {
      const result = await runAgent(
        generatorAgent,
        `Generate a Page Object and E2E test for the page at ${url}. ` +
        `Study the existing project patterns first, then create files that ` +
        `integrate seamlessly with the current test suite.`,
      );

      /*
       * Browser is launched lazily on first navigate_to_page call and
       * persists for the duration of the agent run. Must be closed here —
       * otherwise the Chromium process keeps the Node.js event loop alive.
       */
      await closeBrowser();

      const writtenFiles = getWrittenFiles(result.steps);

      console.log('\n' + '='.repeat(60));
      console.log(result.completed ? '✅ Generation complete' : '⚠️  Reached max iterations');
      console.log(`Iterations used: ${result.iterationsUsed}`);
      console.log('='.repeat(60));
      console.log('\n' + result.response);

      /*
       * If the agent concluded without writing any files (e.g. the page is
       * already covered by existing tests), skip the review prompt —
       * there is nothing to keep, rewrite, or delete.
       * readline is closed by the finally block below.
       */
      if (writtenFiles.length === 0) {
        console.log('\n⚠️  No files were generated — see agent response above.');
        return;
      }

      console.log('\n📁 Generated files — open in editor to review before deciding:');
      writtenFiles.forEach((f) => console.log(`   ${f}`));

      const decision = await askDecision(rl);

      if (decision === 'keep') {
        console.log('\n✅ Files kept.');
        break;
      }

      if (decision === 'delete') {
        await deleteGeneratedFiles(writtenFiles);
        console.log('\n🗑️  Generated files deleted.');
        break;
      }

      /*
       * rewrite — delete current files and loop back to run the agent again.
       * The generator will start fresh: navigate, inspect, read patterns,
       * and generate a new version. Useful when the first attempt produced
       * incorrect locators or poor test structure.
       */
      await deleteGeneratedFiles(writtenFiles);
      console.log('\n🔄 Files deleted. Re-running generator...\n');
    }
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  if (mode === '--analyze') await runAnalyze();
  if (mode === '--generate') {
    if (!target) {
      console.log('Error: URL required — npm run agent:generate <url>');
      process.exit(1);
    }
    await runGenerate(target);
  }
}

main().catch(console.error);