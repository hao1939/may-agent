/**
 * master-worker-resilient.ts — Resilient master-worker orchestration layer.
 *
 * Combines:
 *   - ProjectCache (from master-worker-cached.ts) for I/O efficiency
 *   - RetryWrapper (from retry-wrapper.ts) for LLM call resilience
 *
 * Wraps the LLM dispatch call with circuit-breaker-aware retries so that
 * transient provider errors don't kill entire iteration runs.
 */

import {
  type CachedProjectContext,
  type IterationSnapshot,
  createCachedContext,
  buildIterationSnapshot,
  shouldStop,
  formatOrchestratorContext,
  appendJournalEntry,
  flushBetweenIterations,
  getCacheReport,
} from "./master-worker-cached.ts";

import {
  type RetryConfig,
  type RetryResult,
  type CircuitState,
  createRetryWrapper,
  createInitialCircuitState,
  getEffectiveCircuitState,
  mergeConfig,
  calculateDelay,
  shouldRetry,
  recordSuccess,
  recordFailure,
  RetryWrapper,
} from "./retry-wrapper.ts";

// ── Types ───────────────────────────────────────────────────────────────

export interface ResilientConfig {
  projectDir: string;
  maxIterations: number;
  cacheTtlMs?: number;
  retry?: Partial<RetryConfig>;
}

export interface LLMProvider {
  (prompt: string): Promise<string>;
}

export interface IterationResult {
  iteration: number;
  success: boolean;
  output: string | null;
  retryAttempts: number;
  circuitState: "closed" | "open" | "half-open";
  durationMs: number;
  error?: string;
}

export interface RunResult {
  iterations: IterationResult[];
  totalIterations: number;
  successfulIterations: number;
  failedIterations: number;
  circuitBreakerTrips: number;
  cacheReport: string;
  stoppedEarly: boolean;
  stopReason: string;
}

// ── Pure helper functions (exported for testing) ────────────────────────

/** Determine circuit state label from a CircuitState object */
export function getCircuitLabel(circuit: CircuitState, now = Date.now()): "closed" | "open" | "half-open" {
  const effective = getEffectiveCircuitState(circuit, now);
  return effective.isOpen ? (effective === circuit ? "open" : "half-open") : "closed";
}

/** More reliable circuit label using the raw state */
export function classifyCircuit(circuit: CircuitState, recoveryMs: number, now = Date.now()): "closed" | "open" | "half-open" {
  if (!circuit.isOpen) return "closed";
  const elapsed = now - circuit.lastFailureTime;
  if (elapsed >= recoveryMs) return "half-open";
  return "open";
}

/** Build a prompt for the LLM from iteration context */
export function buildPrompt(snapshot: IterationSnapshot, orchestratorContext: string): string {
  return [
    `## Iteration ${snapshot.iteration}/${snapshot.maxIterations}`,
    "",
    "### Project Status",
    `Status: ${snapshot.status}`,
    "",
    "### Orchestrator Context",
    orchestratorContext,
    "",
    "### Journal (tail)",
    snapshot.journalTail,
    "",
    snapshot.discussionContent ? `### Discussion\n${snapshot.discussionContent}\n` : "",
    "## Session Contract",
    "You are starting a FRESH session. Your job is to produce FILES, not verify state.",
    "- If the task seems \"already done\": produce a verification report or improvement.",
    "- If truly nothing remains: write a completion-evidence file documenting WHY with specific tool output.",
    "- An empty session (0 files produced) is always a failure, regardless of project state.",
    "",
    "Produce the next deliverable for this project.",
  ].join("\n");
}

/** Summarize a run's results */
export function summarizeRun(results: IterationResult[]): {
  total: number;
  succeeded: number;
  failed: number;
  circuitTrips: number;
} {
  let circuitTrips = 0;
  let succeeded = 0;
  let failed = 0;
  for (const r of results) {
    if (r.success) succeeded++;
    else failed++;
    if (r.circuitState === "open") circuitTrips++;
  }
  return { total: results.length, succeeded, failed, circuitTrips };
}

/** Determine if the run should abort due to consecutive failures */
export function shouldAbort(results: IterationResult[], maxConsecutiveFailures = 3): boolean {
  if (results.length < maxConsecutiveFailures) return false;
  const tail = results.slice(-maxConsecutiveFailures);
  return tail.every(r => !r.success);
}

/** Format an iteration result as a journal entry */
export function formatJournalEntry(result: IterationResult): string {
  const status = result.success ? "✅" : "❌";
  const retries = result.retryAttempts > 0 ? ` (${result.retryAttempts} retries)` : "";
  const circuit = result.circuitState !== "closed" ? ` [circuit: ${result.circuitState}]` : "";
  const duration = `${result.durationMs}ms`;
  return `${status} Iteration ${result.iteration}: ${duration}${retries}${circuit}${result.error ? ` — ${result.error}` : ""}`;
}

/** Calculate overall success rate */
export function successRate(results: IterationResult[]): number {
  if (results.length === 0) return 0;
  return results.filter(r => r.success).length / results.length;
}

/** Merge resilient config with defaults */
export function mergeResilientConfig(partial: Partial<ResilientConfig> & { projectDir: string }): ResilientConfig {
  return {
    projectDir: partial.projectDir,
    maxIterations: partial.maxIterations ?? 5,
    cacheTtlMs: partial.cacheTtlMs ?? 30000,
    retry: partial.retry ?? {},
  };
}

// ── Orchestration class ─────────────────────────────────────────────────

export class ResilientMasterWorker {
  private ctx: CachedProjectContext;
  private retryWrapper: RetryWrapper;
  private config: ResilientConfig;
  private results: IterationResult[] = [];

  constructor(config: ResilientConfig) {
    this.config = mergeResilientConfig(config);
    this.ctx = createCachedContext(this.config.projectDir, this.config.cacheTtlMs);
    this.retryWrapper = createRetryWrapper(this.config.retry);
  }

  /** Run a single iteration with retry + circuit breaker */
  async runIteration(iteration: number, llm: LLMProvider): Promise<IterationResult> {
    const start = Date.now();

    const snapshot = buildIterationSnapshot(this.ctx, iteration);
    if (!snapshot) {
      return {
        iteration,
        success: false,
        output: null,
        retryAttempts: 0,
        circuitState: classifyCircuit(
          this.retryWrapper.getCircuitState(),
          mergeConfig(this.config.retry).circuitRecoveryMs
        ),
        durationMs: Date.now() - start,
        error: "Failed to build iteration snapshot",
      };
    }

    const stopCheck = shouldStop(snapshot);
    if (stopCheck.stop) {
      return {
        iteration,
        success: false,
        output: null,
        retryAttempts: 0,
        circuitState: classifyCircuit(
          this.retryWrapper.getCircuitState(),
          mergeConfig(this.config.retry).circuitRecoveryMs
        ),
        durationMs: Date.now() - start,
        error: `Stopped: ${stopCheck.reason}`,
      };
    }

    const orchestratorContext = formatOrchestratorContext(snapshot);
    const prompt = buildPrompt(snapshot, orchestratorContext);

    const retryResult: RetryResult<string> = await this.retryWrapper.execute(
      () => llm(prompt),
      `iteration-${iteration}`
    );

    const circuitState = classifyCircuit(
      this.retryWrapper.getCircuitState(),
      mergeConfig(this.config.retry).circuitRecoveryMs
    );

    const result: IterationResult = {
      iteration,
      success: retryResult.success,
      output: retryResult.success ? retryResult.value : null,
      retryAttempts: retryResult.attempts - 1,
      circuitState,
      durationMs: Date.now() - start,
      error: retryResult.success ? undefined : retryResult.error?.message,
    };

    // Log to journal
    appendJournalEntry(this.ctx, formatJournalEntry(result));
    flushBetweenIterations(this.ctx);

    this.results.push(result);
    return result;
  }

  /** Run all iterations */
  async run(llm: LLMProvider): Promise<RunResult> {
    this.results = [];
    let stopReason = "completed";
    let stoppedEarly = false;

    for (let i = 1; i <= this.config.maxIterations; i++) {
      const result = await this.runIteration(i, llm);

      if (result.error?.startsWith("Stopped:")) {
        stoppedEarly = true;
        stopReason = result.error;
        break;
      }

      if (shouldAbort(this.results)) {
        stoppedEarly = true;
        stopReason = "Aborted: 3 consecutive failures";
        break;
      }
    }

    const summary = summarizeRun(this.results);
    return {
      iterations: this.results,
      totalIterations: summary.total,
      successfulIterations: summary.succeeded,
      failedIterations: summary.failed,
      circuitBreakerTrips: summary.circuitTrips,
      cacheReport: getCacheReport(this.ctx),
      stoppedEarly,
      stopReason,
    };
  }

  getResults(): IterationResult[] {
    return [...this.results];
  }

  getCircuitState(): CircuitState {
    return this.retryWrapper.getCircuitState();
  }
}

export function createResilientMasterWorker(config: ResilientConfig): ResilientMasterWorker {
  return new ResilientMasterWorker(config);
}
