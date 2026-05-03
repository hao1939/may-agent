/**
 * master-worker-migration-adapter.ts — Adapter showing how to migrate from
 * master-worker-resilient.ts to master-worker-unified.ts.
 *
 * This module re-exports the unified interface with convenience wrappers
 * that match the resilient API shape, allowing gradual migration.
 */

import {
  type MasterWorkerConfig as UnifiedOptions,
  type RunResult as UnifiedResult,
  runMasterWorker,
} from "./master-worker-unified.ts";

import {
  type ResilientConfig,
  type LLMProvider,
  type IterationResult,
} from "./master-worker-resilient.ts";

// ── Adapter: Convert ResilientConfig → UnifiedOptions ───────────────────

export function resilientConfigToUnified(
  config: ResilientConfig,
  provider: LLMProvider
): UnifiedOptions {
  return {
    projectDir: config.projectDir,
    maxIterations: config.maxIterations ?? 10,
    cache: {
      enabled: true,
      ttlMs: 30000,
    },
    resilience: {
      enabled: true,
      maxRetries: config.retryConfig?.maxAttempts ?? 3,
      baseDelayMs: config.retryConfig?.baseDelayMs ?? 1000,
      maxDelayMs: config.retryConfig?.maxDelayMs ?? 30000,
      circuitBreaker: true,
    },
    healthCheck: {
      enabled: false,
    },
    provider: {
      dispatch: provider.dispatch,
    },
  };
}

// ── Drop-in replacement function ────────────────────────────────────────

/**
 * Drop-in replacement for `createResilientMasterWorker(config).run()`.
 * Converts resilient config to unified options and delegates.
 */
export async function runResilientViaUnified(
  config: ResilientConfig,
  provider: LLMProvider
): Promise<UnifiedResult> {
  const options = resilientConfigToUnified(config, provider);
  return runMasterWorker(options);
}

// ── Re-exports for backward compatibility ───────────────────────────────

export { runMasterWorker, type MasterWorkerConfig as UnifiedOptions, type UnifiedResult } from "./master-worker-unified.ts";
export { type ResilientConfig, type LLMProvider } from "./master-worker-resilient.ts";
