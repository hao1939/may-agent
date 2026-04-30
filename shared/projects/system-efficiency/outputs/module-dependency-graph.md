# Module Dependency Graph — Workflow Toolkit

## Executive Summary
Analysis of 11 core workflow modules reveals a clean layered architecture with no circular dependencies. 7 modules are fully standalone, 4 have internal dependencies.

## Standalone Modules (No Internal Dependencies)
These modules can be used independently with zero coupling:

| Module | Purpose |
|--------|---------|
| `incremental-checkpoint.ts` | Crash recovery via periodic state saves |
| `provider-retry.ts` | Exponential backoff for transient errors |
| `output-validator.ts` | Validates file content before writes |
| `task-validator.ts` | Fast-fail rejection of doomed tasks |
| `complexity-estimator.ts` | Task complexity scoring (1-5) |
| `iteration-timer.ts` | Start/end timing with stats (avg/median/p95) |
| `iteration-budget.ts` | Per-iteration token/time budget enforcement |

## Modules With Internal Dependencies

| Module | Depends On | Reason |
|--------|-----------|--------|
| `fast-path.ts` | `output-validator.ts`, `complexity-estimator.ts` | Skips full validation for simple tasks |
| `metrics-dashboard.ts` | (filesystem only) | Scans for test/output files |
| `metrics-aggregator.ts` | (filesystem only) | Reads satellite project.md files |
| `health-check.ts` | `metrics-dashboard.ts`, `metrics-aggregator.ts` | Aggregates all health data |

## Dependency Graph (ASCII)

```
                    master-worker.ts (integration hub)
                    ├── task-validator
                    ├── complexity-estimator
                    │   └── iteration-budget (uses score)
                    ├── incremental-checkpoint
                    ├── provider-retry
                    ├── output-validator
                    │   └── fast-path (wraps validator + estimator)
                    ├── iteration-timer
                    ├── metrics-dashboard
                    │   └── health-check (uses dashboard + aggregator)
                    └── metrics-aggregator
                        └── health-check (uses dashboard + aggregator)
```

## Layered Architecture

```
Layer 3 (Composed):    fast-path, health-check
                           │              │
Layer 2 (Specialized): output-validator  metrics-dashboard
                       complexity-est.   metrics-aggregator
                           │
Layer 1 (Standalone):  incremental-checkpoint, provider-retry,
                       task-validator, complexity-estimator,
                       iteration-timer, iteration-budget
                           │
Layer 0 (Integration): master-worker.ts (imports all)
                       index.ts (barrel re-export)
```

## Circular Dependency Analysis
**Result: No circular dependencies detected.**

All dependencies flow downward (composed → specialized → standalone). The barrel export `index.ts` re-exports without creating cycles since it has no logic.

## Key Observations
1. **7 of 11 modules are standalone** — high cohesion, low coupling
2. **Only `fast-path` and `health-check`** compose multiple internal modules
3. **`master-worker.ts`** is the sole integration hub — all modules converge there
4. **No transitive dependency chains longer than 2** — easy to reason about
5. **Each module has its own test file** — no test coupling issues
