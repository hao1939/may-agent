# Handler failure patterns and stale backlog follow-up

Date: 2026-05-03
Owner: dev

## Signal

Current live reliability metrics are green:

- `handler.failed-count`: `0`
- `handler.success-rate`: `1`
- `session.error-rate-6h`: `0`

But the events table still has five pending `handler.failed` rows older than 87 hours. Since these failures are outside the 6h reliability window, the dashboard no longer calls attention to them.

## Evidence

Readonly DB checks during this heartbeat showed:

- 6h session status: `484 done`, `1 running`, `0 error`.
- Pending handler failure backlog: `5` rows, oldest age about `93.1h`.
- Handler failure groups in the last 7d:
  - `eval-poller`: `Handler "eval-poller" timed out after 300s`, count `4`, latest age about `91.6h`.
  - `heartbeat-bob`: `ResolveMessage: Cannot find module '../../../src/lib/workflow-tool.ts' from '/app/agents/may/handlers/run-workflow.ts'`, count `1`, latest age about `87.7h`.

`agents/may/handlers/eval-poller.ts` already contains timeout mitigations:

- `MAX_LLM_EVALS_PER_RUN = 12`
- `MAX_HEURISTIC_EVALS_PER_RUN = 200`
- `WALL_CLOCK_BUDGET_MS = 240_000`

No `eval-poller` handler failures have occurred since these stale events, so this looks fixed in runtime behavior but not resolved in event lifecycle/backlog state.

`agents/may/handlers/run-workflow.ts` no longer imports `workflow-tool.ts`; it builds the workflow context inline. The stale `heartbeat-bob` failure likely came from a pre-patch runtime instance or cached import path. The current file's header explicitly says: `No imports from src/ — everything inline.`

## Root cause / metric gap

The important remaining problem is not an active failure pattern; it is stale pending failure lifecycle visibility. Windowed metrics can be green while unresolved failure events remain pending for days.

Prior heartbeat work added pending backlog visibility to `agents/dev/workspace/query-heartbeat.js`. This heartbeat extends that helper with a grouped 7d handler-failure view so future triage sees the dominant pattern first rather than reading raw JSON rows one by one.

## Change made

Updated `agents/dev/workspace/query-heartbeat.js` with:

```sql
SELECT json_extract(data, '$.handler') AS handler,
       json_extract(data, '$.error') AS error,
       status,
       COUNT(*) AS count,
       MAX(timestamp) AS lastAt,
       ROUND((? - MAX(timestamp)) / 3600000.0, 1) AS last_age_h
FROM events
WHERE event_type='handler.failed'
  AND timestamp >= ?
GROUP BY handler, error, status
ORDER BY count DESC, lastAt DESC
LIMIT 20
```

## Recommended follow-up

1. Register durable metrics for pending handler failure backlog and oldest pending handler failure age when a safe write path is available.
2. Add or identify an owner workflow/handler that marks stale, investigated `handler.failed` events handled after a documented investigation, rather than leaving them pending indefinitely.
3. If `eval-poller` timeouts recur, reduce `MAX_LLM_EVALS_PER_RUN` further or make the wall-clock budget account for per-evaluation cancellation more aggressively.
