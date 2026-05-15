# Workflow Quality Scores

## Scoring Criteria (100 points max)
| Criterion | Points | Check |
|-----------|--------|-------|
| Has tests | 25 | Corresponding `.test.ts` exists |
| Error handling | 25 | Contains `catch` blocks |
| JSDoc | 20 | Contains `/**` comments |
| Under 200 lines | 15 | `wc -l < 200` |
| No TODOs/FIXMEs | 15 | No TODO/FIXME/HACK/XXX |

## Leaderboard

| File | Tests | Err | JSDoc | Size | Clean | Total |
|------|-------|-----|-------|------|-------|-------|
| worker-retry | 25 | 25 | 20 | 15 | 15 | **100** |
| verify-wrap | 25 | 25 | 20 | 15 | 15 | **100** |
| provider-retry | 25 | 25 | 20 | 15 | 15 | **100** |
| output-validator | 25 | 25 | 20 | 15 | 15 | **100** |
| metrics-collector | 25 | 25 | 20 | 15 | 15 | **100** |
| incremental-checkpoint | 25 | 25 | 20 | 15 | 15 | **100** |
| fewshot-inject-helpers | 25 | 25 | 20 | 15 | 15 | **100** |
| dispatch-validator | 25 | 25 | 20 | 15 | 15 | **100** |
| circuit-breaker | 25 | 25 | 20 | 15 | 15 | **100** |
| workflow-runner | 25 | 25 | 20 | 0 | 15 | **85** |
| retry-wrapper | 25 | 25 | 20 | 0 | 15 | **85** |
| project-cache | 25 | 25 | 20 | 0 | 15 | **85** |
| project | 25 | 25 | 20 | 0 | 15 | **85** |
| master-worker-with-health-check | 25 | 25 | 20 | 0 | 15 | **85** |
| master-worker-unified | 25 | 25 | 20 | 0 | 15 | **85** |
| master-worker-resilient | 25 | 25 | 20 | 0 | 15 | **85** |
| master-worker-cached | 25 | 25 | 20 | 0 | 15 | **85** |
| master-worker | 25 | 25 | 20 | 0 | 15 | **85** |
| implement-and-verify | 25 | 25 | 20 | 0 | 15 | **85** |
| heartbeat-data | 25 | 25 | 20 | 0 | 15 | **85** |
| health-check | 25 | 25 | 20 | 0 | 15 | **85** |
| project-helpers | 25 | 0 | 20 | 15 | 15 | **75** |
| master-worker-migration-adapter | 25 | 0 | 20 | 15 | 15 | **75** |
| iteration-timer | 25 | 0 | 20 | 15 | 15 | **75** |
| iteration-budget | 25 | 0 | 20 | 15 | 15 | **75** |
| complexity-estimator | 25 | 0 | 20 | 15 | 15 | **75** |
| budget-checkpoint | 25 | 0 | 20 | 15 | 15 | **75** |
| index | 0 | 0 | 20 | 15 | 15 | **50** |

## Summary
- **9 files** score 100/100 (perfect)
- **12 files** score 85/100 (over 200 lines)
- **6 files** score 75/100 (missing error handling)
- **1 file** scores 50/100 (index — no tests, no error handling)

## Bottom 3 Files (improvement candidates)
1. **index.ts** (50pts) — Missing tests and error handling
2. **budget-checkpoint.ts** (75pts) — No catch blocks
3. **complexity-estimator.ts** (75pts) — No catch blocks

## Script
Run: `./scripts/workflow-quality-score.sh`
