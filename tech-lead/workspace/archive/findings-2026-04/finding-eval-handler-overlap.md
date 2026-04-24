# Finding: Overlap between evaluation-sync.ts and evaluator-heartbeat.ts

**Date**: 2026-04-17  
**Severity**: Medium (duplicate work, potential double-evaluation)

## What Each Handler Does

### evaluation-sync.ts (every 10min)
- **Primary**: Heuristic-evaluate unevaluated sessions (max 50/run). Pure JS scoring based on status, opCount, waste ratio.
- **Secondary**: LLM evaluation sampling — ~30% random sample of heuristic-evaluated sessions, max 5/run via `evaluateStandaloneSession()`.
- **Also**: One-time migration of 1-5 scale scores to 0-1.

### evaluator-heartbeat.ts (every 30min)
- **Primary**: LLM evaluation sampling — pick heuristic-only top-level sessions (parentSessionId IS NULL, opCount > 2), prioritize agents with lowest LLM eval rate, max 3/run via `evaluateStandaloneSession()`.
- **Secondary**: Calibration — check if evaluation pipeline is stale or evaluator workspace is outdated; spawn evaluator LLM session if needed.

## Overlap Analysis

**Both handlers call `evaluateStandaloneSession()` to upgrade heuristic evaluations to LLM evaluations.** This is a clear functional overlap:

| Aspect | evaluation-sync | evaluator-heartbeat |
|--------|----------------|-------------------|
| Frequency | Every 10min | Every 30min |
| LLM budget/run | 5 | 3 |
| Selection | Random 30% of just-heuristic-evaluated | Lowest LLM-rate agents first, top-level only |
| Filter | Any status (done/error), any session | Top-level only (no parentSessionId), opCount > 2 |
| Skips | 0-op interrupted | evaluator, may agents |

**Race condition risk**: A session heuristic-evaluated by evaluation-sync could be picked for LLM upgrade by *both* handlers. `evaluateStandaloneSession()` does INSERT OR REPLACE, so no data corruption, but it wastes LLM cost (~$0.03-0.05 per duplicate eval).

**Max theoretical LLM evals**: 5 per 10min (evaluation-sync) + 3 per 30min = up to 33/hour. In practice much lower due to random sampling and candidate exhaustion.

## What's NOT Overlapping

- **Heuristic evaluation**: Only evaluation-sync does this. evaluator-heartbeat doesn't compute heuristic scores.
- **Calibration**: Only evaluator-heartbeat checks workspace staleness and spawns evaluator LLM calibration sessions.

## Recommendation: Consolidate LLM Sampling

**Keep both handlers, but remove LLM sampling from evaluation-sync.ts.** Rationale:

1. evaluator-heartbeat has smarter selection (agent-balanced, priority by lowest LLM rate) vs evaluation-sync's random 30%.
2. evaluation-sync's core job is heuristic evaluation — it's a WAL bug workaround. LLM sampling was bolted on later.
3. Removing the ~40 lines of LLM sampling from evaluation-sync simplifies it and eliminates the race condition.
4. If higher LLM throughput is desired, increase evaluator-heartbeat's `MAX_LLM_EVALS_PER_RUN` from 3 to 5.

**Do NOT merge the handlers entirely** — they serve different primary purposes (heuristic sync vs calibration+LLM), run at different intervals, and use different DB connection patterns (evaluation-sync uses its own `new Database()` due to WAL bug; evaluator-heartbeat uses `ctx.getDb()`).

## Follow-up Action

- [ ] Remove LLM sampling section from evaluation-sync.ts (lines ~210-250, the `sampled` block)
- [ ] Consider bumping evaluator-heartbeat MAX_LLM_EVALS_PER_RUN to 5 to compensate
