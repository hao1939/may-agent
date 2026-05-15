# Handler failure pending backlog visibility

Date: 2026-05-03
Owner: dev

## Signal

Live metrics are currently green for recent handler reliability:

- `handler.failed-count` current `0` in the current 6h window.
- `handler.success-rate` current `1` in the current 6h window.
- `session.error-rate-6h` current `0`.

However, the `events` table still contains stale pending `handler.failed` events. These are not reflected by the 6h failure metrics because they are old, but they remain operationally unresolved.

## Evidence

`bun agents/dev/workspace/query-heartbeat.js` showed:

```json
{
  "status": "pending",
  "count": 5,
  "oldestAt": 1777491437810,
  "newestAt": 1777510757556,
  "oldest_age_h": 92.6
}
```

The stale pending failures are four `eval-poller` timeout events around 91-93h old plus one `heartbeat-bob` module resolution error around 87h old:

- `Handler "eval-poller" timed out after 300s`
- `ResolveMessage: Cannot find module '../../../src/lib/workflow-tool.ts' from '/app/agents/may/handlers/run-workflow.ts'`

## Root cause / gap

Current green reliability metrics answer "are handlers failing now?" but not "are old handler failures still pending/untriaged?" This lets stale `handler.failed` events sit in `pending` for days while the dashboard looks healthy.

This is distinct from `handler.failed-count` and `handler.success-rate`; both should stay windowed. The missing view is backlog age/count for pending failure events.

## Change made this heartbeat

Updated `agents/dev/workspace/query-heartbeat.js` to add two readonly checks:

1. `pending handler failure backlog` — counts pending `handler.failed` events and reports oldest/newest timestamps plus oldest age in hours.
2. `stale pending handler failures >24h` — lists pending `handler.failed` events older than 24h with age.

This makes the backlog visible in every dev heartbeat without needing direct DB writes or production table changes.

## Recommended follow-up

Register a durable metric when a safe write path is available:

- id: `handler.pending-failure-backlog`
- owner: `dev` or `may`
- query: count `events` rows where `event_type='handler.failed' AND status='pending'`
- alert: `> 0` or `> 3`

Optionally add an age metric:

- id: `handler.pending-failure-oldest-age-h`
- query: `ROUND((unixepoch()*1000 - MIN(timestamp)) / 3600000.0, 1)` for pending handler failures
- alert: `> 24`

A handler/owner should then triage or resolve stale pending handler.failed events rather than leaving them indefinitely pending.
