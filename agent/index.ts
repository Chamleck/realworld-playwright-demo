import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { runAgent } from './core/loop';
import { analystAgent } from './agents/analyst';

/*
 * Load .env before any API clients are instantiated.
 * new GoogleGenerativeAI() in loop.ts reads process.env.GOOGLE_AI_API_KEY
 * at call time (inside runAgent), so this is always guaranteed to run first.
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

async function main(): Promise<void> {
  if (mode === '--analyze') {
    /*
     * Default report path matches Playwright's built-in last-run tracking.
     * Can be overridden with: npm run agent:analyze path/to/report.json
     */
    const reportPath = target ?? 'test-results/.last-run.json';

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

  if (mode === '--generate') {
    /* Phase 2 */
    console.log('Test generator — coming in Phase 2');
  }
}

main().catch(console.error);