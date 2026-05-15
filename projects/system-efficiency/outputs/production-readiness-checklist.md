# Production Readiness Checklist

## Module Readiness Matrix

| Module | Tests | Integrated | Documented | Config Required | Ready |
|--------|-------|------------|------------|-----------------|-------|
| incremental-checkpoint.ts | ~20 | ✅ | ✅ | Checkpoint dir path | ✅ |
| provider-retry.ts | 24 | ✅ | ✅ | Max retries, base delay | ✅ |
| output-validator.ts | 24 | ✅ | ✅ | None | ✅ |
| task-validator.ts | 32 | ✅ | ✅ | None | ✅ |
| complexity-estimator.ts | 28 | ✅ | ✅ | Score→timeout map | ✅ |
| iteration-timer.ts | 24 | ✅ | ✅ | None | ✅ |
| metrics-dashboard.ts | 19 | ✅ | ✅ | Base paths | ✅ |
| fast-path.ts | 25 | ⚠️ Standalone | ✅ | Score threshold | ⚠️ |
| metrics-aggregator.ts | 23 | ✅ | ✅ | Project dirs | ✅ |
| iteration-budget.ts | 26 | ✅ | ✅ | Score→budget map | ✅ |
| health-check.ts | 16 | ⚠️ Standalone | ✅ | Thresholds | ⚠️ |

**Summary**: 9/11 fully integrated, 2 standalone-only (fast-path, health-check).

## Configuration Requirements

| Parameter | Default | Module | Notes |
|-----------|---------|--------|-------|
| `CHECKPOINT_DIR` | `.state/checkpoints/` | incremental-checkpoint | Must be writable |
| `MAX_RETRIES` | 3 | provider-retry | Increase for flaky providers |
| `BASE_DELAY_MS` | 1000 | provider-retry | Exponential: 1s, 2s, 4s |
| `BUDGET_SCORE_MAP` | {1:60s, 2:120s, 3:180s, 4:240s, 5:300s} | iteration-budget | Tune per workload |
| `FAST_PATH_THRESHOLD` | 2 | fast-path | Score ≤ threshold skips duplicate check |
| `TEST_FILE_MIN` | 60 | health-check | Minimum test file count |
| `OUTPUT_FILE_MIN` | 20 | health-check | Minimum output file count |

## Error Handling Gaps

1. **health-check.ts** — No error boundary around individual checks; one failing check aborts all. Fix: wrap each check in try/catch, report partial results.
2. **metrics-aggregator.ts** — Reads project.md files synchronously; large directories could block. Fix: add timeout per file read.
3. **fast-path.ts** — No integration with master-worker; validation bypass not wired into iteration loop. Fix: integrate after output-validator call.
4. **iteration-timer.ts** — Timings stored in memory only; lost on process restart. Fix: persist to checkpoint dir periodically.
5. **metrics-dashboard.ts** — File system scans have no caching; repeated calls re-scan. Fix: add TTL-based cache (30s).

## Deployment Order (Based on Dependencies)

```
Layer 0 (no deps):     task-validator, complexity-estimator, iteration-timer,
                        output-validator, provider-retry, iteration-budget
Layer 1 (Layer 0):     incremental-checkpoint, fast-path (needs output-validator + complexity-estimator)
Layer 2 (filesystem):  metrics-dashboard, metrics-aggregator
Layer 3 (all):         health-check (imports metrics-dashboard, metrics-aggregator)
```

**Deploy bottom-up**: Layer 0 first, then 1, 2, 3. Each layer can be tested independently.

## Monitoring Plan

| Signal | Source | Alert Threshold |
|--------|--------|-----------------|
| Iteration duration | iteration-timer | p95 > 15 min |
| Budget exceeded rate | iteration-budget | > 20% of iterations |
| Provider retry rate | provider-retry | > 3 retries/iteration avg |
| Output rejection rate | output-validator | > 30% rejections |
| Task rejection rate | task-validator | > 50% rejections |
| Health check failures | health-check | Any check failing 3+ consecutive |
| Checkpoint age | incremental-checkpoint | Incomplete checkpoint > 30 min old |

## Rollback Strategy

1. **Per-module rollback**: Each module is imported separately in master-worker.ts. To disable, comment out the import and its call site. No other modules affected (no circular deps).
2. **Feature flags** (recommended): Add `ENABLE_<MODULE>=true/false` env vars. Check at call site:
   ```typescript
   if (process.env.ENABLE_TASK_VALIDATOR !== 'false') {
     const result = validateTask(task);
     if (!result.valid) return earlyExit(result.reason);
   }
   ```
3. **Full rollback**: Revert master-worker.ts to pre-integration state. All modules are additive — removing them returns to baseline behavior.
4. **Rollback order**: Reverse of deployment — disable Layer 3 first, then 2, 1, 0.

## Pre-Deployment Checklist

- [ ] All 11 modules have passing tests (run `npx vitest run`)
- [ ] Full-stack integration test passes (`tests/full-stack-integration.test.ts`)
- [ ] Stress test passes (`tests/resilience-stress.test.ts`)
- [ ] API regression test passes (`tests/workflow-modules-api.test.ts`)
- [ ] Checkpoint directory exists and is writable
- [ ] Environment variables set for configurable parameters
- [ ] Monitoring alerts configured per table above
- [ ] Rollback procedure documented and tested
- [ ] health-check.ts error boundary added (Gap #1)
- [ ] fast-path.ts integrated into master-worker.ts (Gap #3)
