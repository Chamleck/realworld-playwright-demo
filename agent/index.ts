import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { runAgent } from './core/loop';
import type { AgentConfig } from './core/types';

/*
 * Load .env before any API clients are instantiated.
 * new Anthropic() in loop.ts reads process.env.ANTHROPIC_API_KEY
 * at call time (inside runAgent), so this is always guaranteed to run first.
 */
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const mode = process.argv[2];

if (!mode || !['--analyze', '--generate'].includes(mode)) {
  console.log('Usage:');
  console.log('  npm run agent:analyze [report-path]');
  console.log('  npm run agent:generate <url>');
  process.exit(1);
}

/*
 * Temporary smoke-test config — verifies the ReAct loop and API auth
 * work before real agents are wired in Phase 1 and Phase 2.
 * Will be replaced with analystAgent / generatorAgent imports.
 */
const smokeConfig: AgentConfig = {
  name: 'smoke-test',
  systemPrompt: 'You are a helpful assistant. Answer briefly.',
  tools: [],
  maxIterations: 3,
  model: 'gemini-2.5-flash', 
};

async function main(): Promise<void> {
  console.log(`Mode: ${mode}`);

  const result = await runAgent(
    smokeConfig,
    'Say "Phase 0 complete" and nothing else.',
  );

  console.log('\n' + '='.repeat(50));
  console.log(result.completed ? '✅ Smoke test passed' : '❌ Smoke test failed');
  console.log('Response:', result.response);
}

main().catch(console.error);