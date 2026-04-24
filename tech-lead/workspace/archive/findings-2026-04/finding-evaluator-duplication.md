# Finding: Evaluator Duplication Between evaluation-sync.ts and evaluator-heartbeat.ts

**Date**: 2026-04-17  
**Severity**: Medium (wasted LLM cost, confusing ownership)

## Summary

Both `evaluation-sync.ts` and `evaluator-heartbeat.ts` independently perform LLM evaluation sampling of heuristic-only sessions using the same function (`evaluateStandaloneSession` from `src/lib/evaluator.ts`). This means sessions can be double-LLM-evaluated, wasting ~$0.03-0.05 per duplicate, and the two handlers have no coordination mechanism.

## Evidence

### evaluation-sync.ts (lines ~220-260)
- After heuristic batch, samples ~30% of newly-evaluated sessions (`Math.random() < 0.3`)
- Cap: `MAX_LLM_PER_RUN = 5`
- Uses its own `new Database()` connection
- Filters: excludes `evaluator` agent only
- Selection: random from just-processed batch

### evaluator-heartbeat.ts (lines ~150-230, `sampleAndEvaluateTopLevel()`)
- Queries ALL heuristic-only top-level sessions (not just newly processed)
- Cap: `MAX_LLM_EVALS_PER_RUN = 3`
- Uses `ctx.getDb()` connection
- Filters: excludes `evaluator` and `may` agents
- Selection: priority-based (lowest LLM-rate agents first), round-robin across agents

### Shared dependency
Both import and call `evaluateStandaloneSession()` from `src/lib/evaluator.ts` with identical parameters.

## Overlap Analysis

| Aspect | evaluation-sync | evaluator-heartbeat |
|--------|----------------|---------------------|
| **Primary role** | Heuristic eval batch + LLM sampling | Calibration trigger + LLM sampling |
| **LLM sampling** | Random 30% of new batch | Priority-based across all heuristic sessions |
| **Budget** | 5/run | 3/run |
| **DB connection** | Own `new Database()` | `ctx.getDb()` (shared) |
| **Agent filter** | Excludes `evaluator` | Excludes `evaluator`, `may` |
| **Dedup check** | None against evaluator-heartbeat | None against evaluation-sync |

**Key risk**: A session heuristic-evaluated by evaluation-sync can be immediately LLM-sampled by evaluation-sync (30% chance), AND later LLM-sampled again by evaluator-heartbeat (which queries all heuristic-only sessions). There's no guard against double LLM evaluation.

## Recommendation

**Consolidate LLM sampling into evaluator-heartbeat.ts only.** Rationale:
1. evaluator-heartbeat already has the smarter selection strategy (priority-based, round-robin)
2. evaluation-sync's primary job is heuristic evaluation — adding LLM sampling was scope creep
3. Removes the double-evaluation risk without adding coordination logic
4. evaluation-sync keeps its core role: fast heuristic batch processing with its own DB connection

**Action**: Remove lines ~215-260 from evaluation-sync.ts (the LLM sampling block after the transaction). This is a clean cut — the two concerns are already separated by a comment boundary.

### Secondary cleanup
- evaluator-heartbeat.ts uses `db.query()` (lines 78, 86) which is `bun:sqlite` raw method, not the `SqliteDb` wrapper's `prepare()`. This works but is inconsistent with the rest of the codebase. (Previously noted in finding-dead-weight-cron.md)
