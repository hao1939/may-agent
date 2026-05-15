# Workflow Dependency Graph

## Overview

Analysis of import relationships between workflow files in `agents/shared/workflows/`.

## Hub Files (referenced by 5+ other files)

| File | Referenced By |
|------|-------------|
| project.ts | 60 |
| master-worker.ts | 32 |
| health-check.ts | 14 |
| circuit-breaker.ts | 13 |
| output-validator.ts | 11 |
| index.ts | 11 |
| retry-wrapper.ts | 10 |
| provider-retry.ts | 10 |
| dispatch-validator.ts | 10 |
| types.ts | 9 |
| project-cache.ts | 8 |
| incremental-checkpoint.ts | 8 |
| project-helpers.ts | 6 |
| complexity-estimator.ts | 6 |
| worker-retry.ts | 5 |
| master-worker-resilient.ts | 5 |
| master-worker-cached.ts | 5 |
| iteration-timer.ts | 5 |
| iteration-budget.ts | 5 |
| fewshot-inject-helpers.ts | 5 |

## Leaf Files (referenced by ≤2 other files)

| File | Referenced By |
|------|-------------|
| heartbeat-data.ts | 1 |
| master-worker-migration-adapter.ts | 1 |
| metrics-collector.ts | 1 |
| implement-and-verify.ts | 2 |
| master-worker-with-health-check.ts | 2 |
| verify-wrap.ts | 2 |

## Import Graph (index.ts is the main aggregator)

```
index.ts
  ├── incremental-checkpoint.ts
  ├── provider-retry.ts
  ├── output-validator.ts
  ├── complexity-estimator.ts
  ├── iteration-timer.ts
  ├── iteration-budget.ts
  └── health-check.ts
```

Most workflow files are **standalone** — they don't import other workflow files directly. The `index.ts` barrel file re-exports from 7 internal modules. Other workflow files import shared utilities (fs, path, crypto) but not each other.

## Circular Dependencies

**None detected.** All imports flow one direction (leaf → none, index → leaves).

## Summary Table

| File | Imports From Workflows | Imported-By Count | Role |
|------|----------------------|-------------------|------|
| project.ts | 0 | 60 | Core hub |
| master-worker.ts | 0 | 32 | Core hub |
| health-check.ts | 0 | 14 | Utility hub |
| circuit-breaker.ts | 0 | 13 | Utility hub |
| index.ts | 7 | 11 | Barrel/aggregator |
| output-validator.ts | 0 | 11 | Utility |
| retry-wrapper.ts | 0 | 10 | Utility |
| provider-retry.ts | 0 | 10 | Utility |
| dispatch-validator.ts | 0 | 10 | Utility |
| types.ts | 0 | 9 | Type definitions |
| heartbeat-data.ts | 0 | 1 | Leaf (candidate for removal) |
| master-worker-migration-adapter.ts | 0 | 1 | Leaf (candidate for removal) |
| metrics-collector.ts | 0 | 1 | Leaf |

## Key Findings

1. **Architecture is flat** — no deep dependency chains, no circular deps
2. **`project.ts` and `master-worker.ts` are critical** — changes to these affect the most consumers
3. **Leaf candidates for cleanup**: `heartbeat-data.ts` and `master-worker-migration-adapter.ts` have minimal usage (1 reference each, likely only tests)
4. **`index.ts` is the only multi-import file** — it aggregates 7 modules for external consumers
