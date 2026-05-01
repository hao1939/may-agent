# Evaluator heartbeat — 2026-05-01

## Checks performed

### Session evaluation pipeline liveness (DB vs legacy artifacts)
- DB `evaluations.max(createdAt)` = `1777663400831`.
- DB `sessions.max(endedAt)` = `1777663610775`.
- Lag = `209944 ms` (~3.5 minutes).

Interpretation: evaluation writing to DB is live and close to real-time.

### Legacy `.state/evaluations/` directory freshness
- `ls -la .state/evaluations | tail -20` shows newest files around **Apr 29**, with many artifacts last written **Mar 24**.

Interpretation: `.state/evaluations/` is **not** a reliable freshness signal; likely legacy/partial output path drift. Canonical source is the `evaluations` table.

## Noted failure pattern (for future criteria/docs)
- SQL column mismatch: `sessions` table does **not** have `createdAt`; it uses `startedAt`/`endedAt`.
  - This is easy to trip over when doing quick “recency” checks.

## Suggested next actions (not executed in this heartbeat)
- Consider documenting in evaluator knowledge/criteria or a small ops note: 
  - “Use DB `evaluations.createdAt` vs `sessions.endedAt` for lag; ignore `.state/evaluations/` timestamps.”
