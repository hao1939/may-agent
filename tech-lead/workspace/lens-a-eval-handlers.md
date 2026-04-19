# Lens A: evaluation-sync.ts vs evaluator-heartbeat.ts Overlap

**Date**: 2026-04-19  
**Severity**: Medium — duplicated LLM sampling logic, no coordination

## Summary

Both handlers share a clear overlap: **LLM evaluation sampling of heuristic-only sessions**. Each independently calls `evaluateStandaloneSession()` to upgrade heuristic evaluations to LLM evaluations, but with different strategies and no coordination. This means the same session could be LLM-evaluated twice, and the cost budget is effectively double what either handler intends.

## What Each Handler Does

### evaluation-sync.ts
1. **Primary**: Batch heuristic evaluation of unevaluated sessions (`evaluation-sync.ts:186-243` — the transaction block)
2. **Secondary**: Random 30% LLM sampling of the batch it just heuristic-evaluated, max 5 per run (`evaluation-sync.ts:246-283`)
3. Also handles score migration from 1-5 → 0-1 scale (`evaluation-sync.ts:168-183`)

### evaluator-heartbeat.ts
1. **Primary**: Priority-based LLM sampling of heuristic-only top-level sessions, max 3 per run (`evaluator-heartbeat.ts:139-228` — `sampleAndEvaluateTopLevel()`)
2. **Secondary**: Calibration — spawns an evaluator LLM session when the pipeline is stale or workspace is outdated (`evaluator-heartbeat.ts:66-130`)

## Duplicated Logic

| Aspect | evaluation-sync.ts | evaluator-heartbeat.ts |
|--------|-------------------|----------------------|
| LLM sampling | Random 30%, max 5/run (`evaluation-sync.ts:249-252`) | Priority by lowest LLM rate, max 3/run (`evaluator-heartbeat.ts:34`) |
| Skip set | `SKIP_LLM_EVAL_AGENTS = new Set(["evaluator", "may"])` (`evaluation-sync.ts:42`) | Identical set (`evaluator-heartbeat.ts:37`) |
| Shared dep | `evaluateStandaloneSession` from `src/lib/evaluator.js` (`evaluation-sync.ts:39`) | Same import (`evaluator-heartbeat.ts:19`) |
| Scope filter | Filters `status === "interrupted" && opCount === 0` + skip set (`evaluation-sync.ts:253-256`) | Filters `opCount > 2`, `parentSessionId IS NULL`, skip set (`evaluator-heartbeat.ts:175-183`) |

Both write to the same `evaluations` table. Neither checks if the other has already queued or completed an LLM eval for the same session in the current cycle.

## What's NOT Duplicated

- **Heuristic evaluation** is solely in `evaluation-sync.ts` (`computeEvaluation()` at line 107)
- **Calibration** (spawning evaluator LLM agent) is solely in `evaluator-heartbeat.ts` (lines 66-130)
- **Score migration** is solely in `evaluation-sync.ts` (lines 168-183)

## Risk

1. **Double LLM eval**: A session heuristic-evaluated by `evaluation-sync` could be randomly sampled there AND picked by `evaluator-heartbeat`'s priority sampling in the same cron cycle. `evaluateStandaloneSession` writes to `evaluations` via `INSERT OR REPLACE`, so no data corruption — but wasted LLM cost (~$0.03-0.05 per eval).
2. **Divergent skip constants**: Both define `SKIP_LLM_EVAL_AGENTS` independently (`evaluation-sync.ts:42`, `evaluator-heartbeat.ts:37`). If one is updated and the other isn't, they'll disagree on which agents to skip.

## Recommendation

**Don't merge the files** — their primary responsibilities are distinct (heuristic batch eval vs calibration). But:

1. **Remove LLM sampling from evaluation-sync.ts** (lines 246-283). Let `evaluator-heartbeat.ts` own all LLM evaluation sampling — it already has the smarter priority-based strategy.
2. **Extract `SKIP_LLM_EVAL_AGENTS`** to a shared constant (e.g., in `src/lib/evaluator.ts`) to prevent divergence.

This is a follow-up fix, not for this session.
