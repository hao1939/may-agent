# P0: Session evaluation pipeline dormant (DB-backed)

## Signal (binary)
- `sessions last 6h (ms): 896` (in `.state/may.db`)
- `evaluations last 6h: 0`
- `evaluations max(createdAt)= 2026-04-16T14:32:21.389Z` (~13 days stale)

Commands (evidence):
- `select count(*) from sessions where startedAt > (strftime('%s','now')-6*3600)*1000` → 896
- `select count(*) from evaluations where createdAt > datetime('now','-6 hours')` → 0
- `select max(createdAt) from evaluations` → 2026-04-16T14:32:21.389Z

## Observations
- `agents/may/cron.json` contains an enabled event handler `session-eval` that triggers on `session.completed`.
- If `session.completed` events are not being emitted (or handler failing), evaluations will not be written.
- `.state/evaluations/` directory mtimes are stale (latest Apr 20), consistent with pipeline dormancy.

## Hypotheses to check (owner: May / Tech-lead)
1. **Event emission gap**: `session.completed` not emitted (note: cron.json already includes `context-learn-poller` as workaround for missing events).
2. **Handler failure**: `session-eval` handler throws / disabled by runtime guard.
3. **Heuristic/skip-only**: evaluations may be recorded as `skipped` only; latest 5 are all `verdict='skipped'` at the same timestamp.

## Recommended next steps
- Inspect handler health metrics / logs for `session-eval` (and whether `metrics-snapshot` shows failures).
- Confirm whether `session.completed` events exist in event log; if not, implement a **poller** analogous to `context-learn-poller` for evaluations.
- Decide policy: do we want LLM eval, heuristic eval, or both? Current DB has neither recently.
