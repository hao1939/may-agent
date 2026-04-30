/**
 * master-worker-unified.ts — Single entry point for all master-worker variants.
 *
 * Consolidates: base, cached, resilient, and health-check variants into one
 * configurable interface. Select behaviors via optional config flags.
 */

import {
  createCachedContext,
  buildIterationSnapshot,
  shouldStop,
  formatOrchestratorContext,
  appendJournalEntry,
  flushBetweenIterations,
  getCacheReport,
  type CachedProjectContext,
  type IterationSnapshot,
} from "./master-worker-cached.ts";

import {
  type RetryConfig,
  type RetryResult,
  type CircuitState,
  createRetryWrapper,
  createInitialCircuitState,
  getEffectiveCircuitState,
} from "./retry-wrapper.ts";

// ── Configuration ───────────────────────────────────────────────────────

export interface CacheConfig {
  enabled: boolean;
  ttlMs?: number; // default: 30000
}

export interface ResilienceConfig {
  enabled: boolean;
  maxRetries?: number; // default: 3
  baseDelayMs?: number; // default: 1000
  maxDelayMs?: number; // default: 30000
  circuitBreaker?: boolean; // default: true
}

export interface HealthCheckConfig {
  enabled: boolean;
  stalledThresholdMs?: number; // default: 86400000 (24h)
  skipOnStalled?: boolean; // default: true
  skipOnMissing?: boolean; // default: true
  skipOnMalformed?: boolean; // default: false
}

export interface MasterWorkerConfig {
  projectDir: string;
  maxIterations?: number; // default: 50
  cache?: CacheConfig;
  resilience?: ResilienceConfig;
  healthCheck?: HealthCheckConfig;
  dispatch: (context: string, iteration: number) => Promise<string>;
}

export interface RunResult {
  iterations: number;
  stopped: boolean;
  stopReason: string;
  cacheReport?: string;
  circuitBreakerTrips?: number;
  healthCheckResult?: { proceed: boolean; reason: string };
}

// ── Defaults ────────────────────────────────────────────────────────────

const DEFAULT_MAX_ITERATIONS = 50;
const DEFAULT_CACHE_TTL = 30000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY = 1000;
const DEFAULT_MAX_DELAY = 30000;
const DEFAULT_STALLED_THRESHOLD = 86400000;

// ── Health Check (inline, avoids hard dependency on health-check.js) ────

async function runHealthCheck(
  projectDir: string,
  config: HealthCheckConfig
): Promise<{ proceed: boolean; reason: string }> {
  const { existsSync } = await import("node:fs");
  const { join } = await import("node:path");

  const projectFile = join(projectDir, "project.md");

  if (!existsSync(projectFile)) {
    if (config.skipOnMissing ?? true) {
      return { proceed: false, reason: "project.md not found" };
    }
    return { proceed: true, reason: "project.md missing but skipOnMissing=false" };
  }

  const { statSync, readFileSync } = await import("node:fs");
  const stat = statSync(projectFile);
  const stalledMs = config.stalledThresholdMs ?? DEFAULT_STALLED_THRESHOLD;
  const age = Date.now() - stat.mtimeMs;

  if (age > stalledMs && (config.skipOnStalled ?? true)) {
    return { proceed: false, reason: `stalled: last modified ${Math.round(age / 3600000)}h ago` };
  }

  // Basic malformation check
  const content = readFileSync(projectFile, "utf-8");
  if (content.trim().length < 10 && (config.skipOnMalformed ?? false)) {
    return { proceed: false, reason: "project.md appears malformed" };
  }

  return { proceed: true, reason: "healthy" };
}

// ── Main Entry Point ────────────────────────────────────────────────────

export async function runMasterWorker(config: MasterWorkerConfig): Promise<RunResult> {
  const maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const result: RunResult = {
    iterations: 0,
    stopped: false,
    stopReason: "completed",
  };

  // Phase 1: Health check (if enabled)
  if (config.healthCheck?.enabled) {
    const hcResult = await runHealthCheck(config.projectDir, config.healthCheck);
    result.healthCheckResult = hcResult;
    if (!hcResult.proceed) {
      result.stopped = true;
      result.stopReason = `health-check: ${hcResult.reason}`;
      return result;
    }
  }

  // Phase 2: Set up context (cached or direct)
  let ctx: CachedProjectContext | null = null;
  if (config.cache?.enabled) {
    ctx = createCachedContext(config.projectDir, config.cache.ttlMs ?? DEFAULT_CACHE_TTL);
  }

  // Phase 3: Set up resilience (if enabled)
  let circuitState: CircuitState | null = null;
  let retryWrapper: ReturnType<typeof createRetryWrapper> | null = null;
  if (config.resilience?.enabled) {
    circuitState = createInitialCircuitState();
    const retryConfig: Partial<RetryConfig> = {
      maxAttempts: config.resilience.maxRetries ?? DEFAULT_MAX_RETRIES,
      baseDelayMs: config.resilience.baseDelayMs ?? DEFAULT_BASE_DELAY,
      maxDelayMs: config.resilience.maxDelayMs ?? DEFAULT_MAX_DELAY,
    };
    retryWrapper = createRetryWrapper(retryConfig);
  }

  // Phase 4: Iteration loop
  let circuitTrips = 0;
  for (let i = 1; i <= maxIterations; i++) {
    result.iterations = i;

    // Build context string
    let contextStr: string;
    if (ctx) {
      const snapshot = buildIterationSnapshot(ctx, i);
      if (snapshot) {
        contextStr = formatOrchestratorContext(snapshot);
      } else {
        contextStr = `iteration ${i}/${maxIterations}`;
      }
    } else {
      contextStr = `iteration ${i}/${maxIterations}`;
    }

    // Dispatch (with or without resilience)
    let response: string;
    try {
      if (retryWrapper && circuitState) {
        const effective = getEffectiveCircuitState(circuitState);
        if (effective.state === "open") {
          circuitTrips++;
          result.stopped = true;
          result.stopReason = "circuit-breaker-open";
          break;
        }
        const retryResult: RetryResult<string> = await retryWrapper(
          () => config.dispatch(contextStr, i)
        );
        response = retryResult.result;
      } else {
        response = await config.dispatch(contextStr, i);
      }
    } catch (err) {
      result.stopped = true;
      result.stopReason = `dispatch-error: ${(err as Error).message}`;
      break;
    }

    // Record response
    if (ctx) {
      appendJournalEntry(ctx, `## Iteration ${i}\n\n${response}\n`);
    }

    // Check stop condition
    if (ctx) {
      const snapshot = buildIterationSnapshot(ctx, i);
      if (snapshot) {
        const stopCheck = shouldStop(snapshot);
        if (stopCheck.stop) {
          result.stopped = true;
          result.stopReason = "worker-signaled-stop";
          break;
        }
      }
    }

    // Flush caches between iterations
    if (ctx) {
      flushBetweenIterations(ctx);
    }
  }

  // Finalize
  if (ctx && config.cache?.enabled) {
    const report = getCacheReport(ctx);
    result.cacheReport = report;
  }
  if (circuitTrips > 0) {
    result.circuitBreakerTrips = circuitTrips;
  }

  return result;
}
