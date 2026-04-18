# Cleanup: Evaluation Dead Code Removal

**Date**: 2026-04-12
**Branch**: `review/s_1775971448515_1880`
**Status**: COMPLETE — awaiting merge to main
**Builds on**: Lens A + Lens B audits

## What was removed

### Dead Functions (from `src/lib/evaluator.ts`)
| Function | Lines removed | Why dead |
|---|---|---|
| `writeSkippedEvaluations` | ~100 | Path 2: startup fire-and-forget, superseded by evaluation-sync handler |
| `writeHeuristicEvaluations` | ~70 | Path 3: startup fire-and-forget, superseded by evaluation-sync handler |
| `computeHeuristicScores` | ~400 | Only consumer was writeHeuristicEvaluations |
| `detectFrustrationSignals` | ~140 | Only consumer was computeHeuristicScores |
| `extractFinishCallParams` | ~40 | Only consumer was computeHeuristicScores |
| `FrustrationSignals` interface | ~25 | Only consumer was detectFrustrationSignals |

### Dead Wiring (across files)
- `src/app/may.ts`: Removed 2 fire-and-forget startup calls + imports
- `src/app/agent-loader.ts`: Removed handler context wiring for both functions
- `src/lib/handler-context.ts`: Removed 2 interface properties
- `src/lib/index.ts`: Removed 2 re-exports

### Dead Tests
- `test/evaluator-frustration.test.ts` (253 lines) — tested detectFrustrationSignals
- `test/evaluator-heuristic.test.ts` (1203 lines) — tested computeHeuristicScores

## Impact
- `evaluator.ts`: 1640 → 831 lines (**-49%**)
- Total: **-2,373 lines** removed, **+67 lines** adjusted
- 9 files changed

## What was preserved
- `evaluateTask()` — Path 1, LLM evaluation (active but rarely used)
- `evaluation-sync` cron handler — Path 4, the one true active evaluation path
- `findUnevaluatedChildren()`, `extractUsage()`, `getAgentScoreSummary()` — still used
- `hasEvaluation`, `upsertEvaluation` — used by evaluateTask/findUnevaluatedChildren
- `extractTimestamp` — used by evaluateTask

## Verification
- `tsc --noEmit`: **0 errors**
- `vitest run`: 130/132 suites pass, 1931/1932 tests pass
  - 2 pre-existing failures unrelated to this change:
    1. `research-to-production.test.ts` — missing workflow module file
    2. `research-db.test.ts` — flaky count assertion (6 vs threshold 5)

## Consumer Analysis (why safe to remove)

### `writeSkippedEvaluations`
- Called at may.ts startup (line ~543) — fire-and-forget
- Exposed via HandlerContext — NO handler uses it
- system-status.ts references it in a diagnostic string (kept, not a function call)

### `writeHeuristicEvaluations`
- Called at may.ts startup (line ~551) — fire-and-forget  
- Exposed via HandlerContext — NO handler uses it

### `computeHeuristicScores`
- Only called by writeHeuristicEvaluations
- The evaluation-sync handler has its OWN scoring logic (simpler, standalone)

### `detectFrustrationSignals` + `extractFinishCallParams`
- Internal functions, not exported from index.ts
- Only called within computeHeuristicScores
