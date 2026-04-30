# Master-Worker Consolidation Migration Guide

## Overview

The `master-worker-unified.ts` module replaces 4 legacy variants with a single configurable entry point. Benchmark results show <1ms absolute overhead (negligible in real-world use).

## Unified API

```typescript
import { runMasterWorker } from './workflows/master-worker-unified';

const result = await runMasterWorker({
  task: "Your task description",
  agent: agentProvider,
  maxIterations: 10,
  // Optional behavior flags:
  cache: false,        // Enable response caching (replaces master-worker-cached.ts)
  resilient: false,    // Enable retry/recovery (replaces master-worker-resilient.ts)
  healthCheck: false,  // Enable health monitoring (replaces master-worker-with-health-check.ts)
});
```

## Migration by Variant

### From `master-worker.ts` (base)

**Before:**
```typescript
import { runMasterWorker } from './workflows/master-worker';
const result = await runMasterWorker({ task, agent, maxIterations });
```

**After:**
```typescript
import { runMasterWorker } from './workflows/master-worker-unified';
const result = await runMasterWorker({ task, agent, maxIterations });
```

No flags needed — base behavior is the default.

### From `master-worker-cached.ts`

**Before:**
```typescript
import { runCachedMasterWorker } from './workflows/master-worker-cached';
const result = await runCachedMasterWorker({ task, agent, maxIterations, cacheKey });
```

**After:**
```typescript
import { runMasterWorker } from './workflows/master-worker-unified';
const result = await runMasterWorker({ task, agent, maxIterations, cache: true });
```

### From `master-worker-resilient.ts`

**Before:**
```typescript
import { runResilientMasterWorker } from './workflows/master-worker-resilient';
const result = await runResilientMasterWorker({ task, agent, maxIterations, retries: 3 });
```

**After:**
```typescript
import { runMasterWorker } from './workflows/master-worker-unified';
const result = await runMasterWorker({ task, agent, maxIterations, resilient: true });
```

### From `master-worker-with-health-check.ts`

**Before:**
```typescript
import { runHealthCheckedMasterWorker } from './workflows/master-worker-with-health-check';
const result = await runHealthCheckedMasterWorker({ task, agent, maxIterations, healthInterval: 5000 });
```

**After:**
```typescript
import { runMasterWorker } from './workflows/master-worker-unified';
const result = await runMasterWorker({ task, agent, maxIterations, healthCheck: true });
```

### Combining Features

The unified interface supports any combination:

```typescript
// Resilient + cached (previously required custom wiring)
const result = await runMasterWorker({
  task, agent, maxIterations,
  resilient: true,
  cache: true,
});
```

## Performance Impact

| Metric | Base | Unified | Difference |
|--------|------|---------|------------|
| Avg latency per call | ~0.01ms | ~0.02ms | <1ms |
| 100-iteration total | ~1ms | ~2ms | negligible |

The unified module adds a config-parsing layer that costs <1ms absolute overhead. In real workflows where each iteration involves LLM calls (1-30s), this is unmeasurable.

## Deprecation Plan

The following files should be marked `@deprecated` and eventually removed:

1. `master-worker.ts` → use unified with no flags
2. `master-worker-cached.ts` → use unified with `cache: true`
3. `master-worker-resilient.ts` → use unified with `resilient: true`
4. `master-worker-with-health-check.ts` → use unified with `healthCheck: true`

Add to each file's top-level export:
```typescript
/** @deprecated Use master-worker-unified.ts instead. See consolidation-migration-guide.md */
```

## Files Reference

- **Unified module:** `/app/agents/shared/workflows/master-worker-unified.ts`
- **RFC:** `/app/agents/shared/projects/system-efficiency/outputs/master-worker-consolidation-rfc.md`
- **Benchmark:** `/app/agents/shared/projects/system-efficiency/outputs/unified-perf-benchmark.ts`
- **Tests:** `/app/agents/shared/tests/master-worker-unified.test.ts` (15 tests, all passing)
