# Evaluator heartbeat — 2026-05-04

## Checks performed

### Session evaluation pipeline freshness (DB = canonical)
- evaluations max(createdAt) = `1777934799942`
- sessions max(startedAt) = `1777935002579`
- lag = `202637 ms` (~3.4 min)

Evidence: `bun:sqlite` query output shows both maxima and computed lag.

### Legacy artifact directory
- `.state/evaluations/` newest files appear to have mtimes around **2026-03-24**.
- Interpretation: legacy output path is stale/drifted, but DB-backed evaluation pipeline is live.

## Notes / follow-ups
- If other agents are still using `.state/evaluations/` mtime as a liveness signal, recommend switching to DB `evaluations.max(createdAt)`.
