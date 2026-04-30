# Evaluator Heartbeat — 2026-04-30

## Checks performed

### Session evaluation pipeline liveness
- DB (`.state/may.db`) shows evaluations are being written recently:
  - `evaluations.maxCreatedAt = 1777511633280`
  - `sessions.maxEndedAt = 1777511762086` (≈ 2026-04-30 01:16:02 UTC)
- 24h volume:
  - `sessions_24h = 1610`
  - `evals_24h = 600`

**Interpretation:** pipeline is live (fresh `createdAt`), but coverage is partial (~37% of sessions evaluated in last 24h).

### Legacy artifact path
- `.state/evaluations/` newest files are from Mar 24.

**Interpretation:** consistent with “legacy-output-path drift”: DB is canonical and fresh; `.state/evaluations/` artifacts are stale and should not be used as a liveness signal.

### Skip/heuristic mix (24h)
- `skippedByJs`: 566 not skipped, 34 skipped
- `evaluatedByHeuristic`: 566 not heuristic, 34 heuristic

**Interpretation:** majority are LLM-based; a small slice is heuristic/skip.

### Who is getting evaluated (24h, top agents)
- coach: 257 evals (avg q=0.448, e=0.418)
- optimizer: 245 evals (avg q=0.540, e=0.531)
- may: 24 evals
- bob: 23 evals
- amy: 19 evals

**Interpretation:** evaluation distribution is heavily skewed toward a small subset of agents; combined with 600/1610 coverage suggests scoping/filtering in the cron rather than a liveness problem.

## Follow-ups recommended
1. Add/restore an explicit **Coverage metric** for evaluator ownership (sessions evaluated / sessions ended in last 24h) so this gap is continuously visible.
2. Investigate `evaluate-session-llm` cron’s selection criteria (agent filter? session kind? status?) to understand why only ~37% are evaluated.
3. Document that `.state/evaluations/` is legacy and may be stale even when DB is fresh (to avoid false alerts).
