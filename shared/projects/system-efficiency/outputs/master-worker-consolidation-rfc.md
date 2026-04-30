# RFC: Master-Worker Variant Consolidation

**Status**: Proposal  
**Date**: 2025-01-21  
**Author**: system-efficiency project

## Summary

Consolidate the 4 master-worker variants (`master-worker.ts`, `master-worker-cached.ts`, `master-worker-resilient.ts`, `master-worker-with-health-check.ts`) into a single configurable entry point with optional behavior flags.

## Current State: 4 Separate Files

| File | Lines | Purpose | Unique Capability |
|------|-------|---------|-------------------|
| `master-worker.ts` | ~400+ | Base orchestration | Decision extraction, iteration loop, journal/discussion I/O |
| `master-worker-cached.ts` | ~200+ | Caching layer | ProjectCache wrapping fs reads, reduces 5-8 reads → 1 per iteration |
| `master-worker-resilient.ts` | ~150+ | Retry + circuit breaker | RetryWrapper integration, circuit state tracking |
| `master-worker-with-health-check.ts` | ~100+ | Pre-flight validation | Health check before dispatch, skip stalled/missing projects |

## API Surface Comparison

### Shared Parameters (all variants)

| Parameter | Type | Default |
|-----------|------|---------|
| `projectDir` / `projectPath` | string | required |
| `maxIterations` | number | 50 / varies |

### Unique Parameters Per Variant

**master-worker.ts** (base):
- Uses `extractField`, `extractSection` from project-helpers
- `IterationTimer`, `createBudget`, `recordIteration`, `recordUsage`
- `validateOutput`, `withRetry`, `estimateComplexity`
- `saveIncrementalCheckpoint`, `detectIncompleteCheckpoint`

**master-worker-cached.ts**:
- `cacheTtlMs?: number` (default 30000)
- Exposes: `createCachedContext`, `buildIterationSnapshot`, `shouldStop`, `formatOrchestratorContext`, `appendJournalEntry`, `flushBetweenIterations`, `getCacheReport`

**master-worker-resilient.ts**:
- `retry?: Partial<RetryConfig>` (maxAttempts, baseDelayMs, maxDelayMs, etc.)
- `cacheTtlMs?: number`
- Returns: `RunResult` with circuit breaker trip counts, cache report

**master-worker-with-health-check.ts**:
- `stalledThresholdMs?: number` (default 24h)
- `skipOnStalled?: boolean` (default true)
- `skipOnMissing?: boolean` (default true)
- `skipOnMalformed?: boolean` (default false)
- Returns: `WorkflowResult` with `PreFlightResult`

## Proposed Unified Interface

```typescript
export interface MasterWorkerConfig {
  // === Required ===
  projectDir: string;

  // === Core behavior ===
  maxIterations?: number;          // default: 50

  // === Caching (opt-in) ===
  cache?: {
    enabled: boolean;              // default: false
    ttlMs?: number;                // default: 30000
  };

  // === Resilience (opt-in) ===
  resilience?: {
    enabled: boolean;              // default: false
    maxRetries?: number;           // default: 3
    baseDelayMs?: number;          // default: 1000
    maxDelayMs?: number;           // default: 30000
    circuitBreaker?: boolean;      // default: true
  };

  // === Health check (opt-in) ===
  healthCheck?: {
    enabled: boolean;              // default: false
    stalledThresholdMs?: number;   // default: 86400000 (24h)
    skipOnStalled?: boolean;       // default: true
    skipOnMissing?: boolean;       // default: true
    skipOnMalformed?: boolean;     // default: false
  };
}

export interface MasterWorkerResult {
  iterations: IterationResult[];
  totalIterations: number;
  successfulIterations: number;
  failedIterations: number;
  stoppedEarly: boolean;
  stopReason: string;

  // Optional sections (present when features enabled)
  cacheReport?: string;
  circuitBreakerTrips?: number;
  preFlight?: PreFlightResult;
}
```

## Migration Path

1. **Phase 1**: Create `master-worker-unified.ts` implementing the unified interface, delegating to existing modules internally.
2. **Phase 2**: Update all callers (workflow runner, CLI) to use the unified entry point.
3. **Phase 3**: Inline the delegated logic, remove the 3 auxiliary files.
4. **Phase 4**: Keep old files as thin re-exports for backward compat (deprecate after 1 sprint).

## Benefits

- **Single import** for all master-worker functionality
- **Composable features** via config flags instead of choosing a file
- **Easier testing** — one interface to mock
- **Reduced duplication** — shared types defined once
- **Discoverability** — users don't need to know which variant to pick

## Risks

- Large refactor touching core workflow path
- Must maintain backward compat during migration
- Test coverage must be preserved (currently 1438 tests)

## Recommendation

**Do Phase 1 first** (unified wrapper delegating to existing modules). This gives immediate API improvement with zero risk to internals. Phases 2-4 can follow incrementally.
