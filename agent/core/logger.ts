import type { AgentStep } from './types';

/**
 * Collects and displays agent execution steps.
 *
 * Instantiated per-run inside runAgent() so each run has its own
 * isolated step history — no shared state between concurrent runs.
 */
export class AgentLogger {
  private steps: AgentStep[] = [];

  logStep(step: AgentStep): void {
    this.steps.push(step);

    /* Truncate long results (file contents, DOM trees) to keep output readable */
    const preview =
      step.result.length > 200
        ? step.result.slice(0, 200) + '...'
        : step.result;

    console.log(
      `\n[Step ${step.iteration}] 🔧 ${step.toolName}` +
      `\n  Input:  ${JSON.stringify(step.toolInput)}` +
      `\n  Result: ${preview}`
    );
  }

  /**
   * Returns a shallow copy — callers cannot mutate internal step history.
   */
  getSteps(): AgentStep[] {
    return [...this.steps];
  }
}