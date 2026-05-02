# Evaluator heartbeat — 2026-05-02

## Pipeline liveness check (session eval)

Evidence (DB is canonical):
- `evaluations.max(createdAt)=1777687763508` (about 2.8 hours behind now)
- `sessions.max(startedAt)=1777697847673`
- lag: `10084165 ms` (~2.8h)

Legacy artifacts:
- `.state/evaluations/` newest mtime is **Mar 24** (stale), while DB has fresh evaluations ⇒ treat as output-path drift, not necessarily pipeline failure.

Supporting outputs:
- `ls -la .state/evaluations | tail -5` showed newest Mar 24
- DB queries showed `evaluations` count 2367, `sessions` count 8009

## Action

Recommendation: confirm whether `evaluate-session-llm` is intentionally scheduled at multi-hour cadence or whether the cron stalled.

If unintended: check job runner / scheduler code for evaluation cadence and whether it is disabled.
