# Finding: evaluation-sync vs evaluator-heartbeat — overlapping LLM sampling

**Lens:** A (System Architecture)
**Date:** 2026-04-17
**Severity:** Medium (cost + clarity, not correctness)

## Summary

The two handlers **are cleanly separated in their primary role** (sync = heuristic/skip row writer; heartbeat = calibration + LLM sampler), **but they both perform top-level LLM sampling**, and the block inside `evaluation-sync.ts` duplicates — less carefully — the logic owned by `evaluator-heartbeat.ts`. Recommend removing the LLM sampling block from `evaluation-sync.ts` and leaving all LLM upgrades to `evaluator-heartbeat.ts`.

## Evidence

### Intended separation (matches doc-strings)

- `agents/may/handlers/evaluation-sync.ts:1-34` — header: "Pure JS — no LLM calls, no cost."
- `agents/may/handlers/evaluator-heartbeat.ts:3-17` — header: two responsibilities, calibration + "Top-level LLM sampling".
- Cron cadence: `agents/may/cron.json:105-111` heartbeat-evaluator every 30 min; `agents/may/cron.json:481-489` evaluation-sync every 10 min.

### Overlap: both call `evaluateStandaloneSession()`

Both handlers import and invoke the same entry point:

- `agents/may/handlers/evaluation-sync.ts:27` imports `evaluateStandaloneSession`.
- `agents/may/handlers/evaluation-sync.ts:362-370` calls it inside an LLM-sampling block that contradicts the file's own "no LLM calls" header at `evaluation-sync.ts:14`.
- `agents/may/handlers/evaluator-heartbeat.ts:26` imports the same function.
- `agents/may/handlers/evaluator-heartbeat.ts:265-272` calls it for each selected session.

### Sampling budgets overlap in the same 30-min window

- `evaluation-sync.ts:343-352` — `MAX_LLM_PER_RUN = 5`, random 30% filter, runs every 10 min ⇒ up to **~15 LLM evals / 30 min**.
- `evaluator-heartbeat.ts:32` — `MAX_LLM_EVALS_PER_RUN = 3`, runs every 30 min ⇒ **3 LLM evals / 30 min**.
- Combined ceiling: ~18 LLM evals per 30 min instead of the 3 the heartbeat docstring advertises as the "cost budget" (`evaluator-heartbeat.ts:19`).

### Sampling filters differ — sync's filter is weaker

- `evaluator-heartbeat.ts:203-215` filters: `parentSessionId IS NULL AND opCount > 2 AND status IN ('done','error') AND agent NOT IN ('evaluator','may')` — correctly targets the gap left by `evaluateTask()` (top-level sessions only).
- `evaluation-sync.ts:346-351` filter: only excludes `status === 'interrupted' && opCount === 0`. No `parentSessionId` check, no agent allowlist beyond the upstream `evaluator` skip in `evaluation-sync.ts:116-127`. This means sync can LLM-evaluate **child** sessions that `evaluateTask()` already evaluates elsewhere — potentially double-paying.

### Smart prioritization lives only in heartbeat

- Agent-rate priority (sample the agents with lowest LLM coverage first) is implemented in `evaluator-heartbeat.ts:187-201` and `evaluator-heartbeat.ts:232-240`.
- `evaluation-sync.ts:353-356` uses `Math.random() < 0.3` — no awareness of per-agent LLM coverage, so it will happily re-sample over-represented agents.

### Redundant queries

- Both handlers read the `evaluations` table to decide what's already done:
  - `evaluation-sync.ts:227-229` — `SELECT sessionId FROM evaluations` (full set) to build `evaluatedIds`.
  - `evaluator-heartbeat.ts:183-195` — `SELECT agent, COUNT(*)... FROM evaluations ... GROUP BY agent`.
  - `evaluator-heartbeat.ts:203-215` — `JOIN evaluations e ON e.sessionId = s.sessionId WHERE e.evaluatedByHeuristic = 1`.
- Both also read the `sessions` table with overlapping filters (`evaluation-sync.ts:234-237` vs `evaluator-heartbeat.ts:204-212`). This is fine on its own (10-min vs 30-min cadence), but the duplication grows once both also emit LLM jobs.

## Candidate merge / fix

**Recommended action (separate session):** Remove the LLM-sampling block from `evaluation-sync.ts:341-383`. Restore the file's "Pure JS — no LLM calls" invariant (`evaluation-sync.ts:14`). Leave all LLM upgrades to `evaluator-heartbeat.ts:170-288`, which already has the right filters, agent-fairness, and budget.

Benefits:
- Cuts LLM spend on evaluations by ~5× (from ~18/30min ceiling back to the advertised 3/30min).
- Eliminates the possibility of LLM-evaluating child sessions already handled by `evaluateTask()`.
- Restores the handler docstring invariant so future readers don't have to audit behavior vs docs.

## Severity

**Medium.** No correctness bug — both paths write valid rows via the same `evaluateStandaloneSession()` code. Impact is:
1. Cost: LLM eval budget is 5–6× the documented ceiling.
2. Clarity: `evaluation-sync.ts`'s header lies about cost (`evaluation-sync.ts:14`).
3. Fairness: sync's random sampling partially undoes heartbeat's agent-rate prioritization.

## Follow-up (do NOT do this session)

1. Delete `evaluation-sync.ts:341-383` and its unused `evaluateStandaloneSession` import at `evaluation-sync.ts:27`.
2. Update docstring at `evaluation-sync.ts:10-14` if needed to re-assert the pure-JS invariant.
3. Run `npm run check` and confirm `heartbeat-evaluator` still LLM-samples at cadence via a synthetic run.
