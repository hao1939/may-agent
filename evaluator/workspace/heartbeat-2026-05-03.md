# Evaluator heartbeat — 2026-05-03

## Checks performed

### Session-evaluation pipeline liveness (DB vs legacy artifacts)
- DB (canonical) has fresh evaluations:
  - `evaluations.max(createdAt) = 1777808796476`
- Sessions are still being created:
  - `sessions.max(startedAt) = 1777809011061`
- Lag (sessions.max(startedAt) - evaluations.max(createdAt)) = `214585 ms` (~3.6 minutes)

Interpretation: evaluation cron appears live (minutes-level lag).

### Legacy `.state/evaluations/` artifacts
- Directory tail shows newest mtime around **2026-03-24**.

Interpretation: legacy task_tree artifact output path is stale/drifted, but not evidence of pipeline failure because DB evaluation rows are current.

## Follow-ups / recommendations
1. Add/clarify in evaluator docs: **use `sessions.startedAt` not `sessions.createdAt`** (sessions table has no `createdAt`).
2. If any tooling still checks `.state/evaluations/` mtimes for liveness, update it to check DB `evaluations.max(createdAt)` instead.
