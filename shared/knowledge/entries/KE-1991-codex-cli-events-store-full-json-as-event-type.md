---
id: KE-1991
title: "Codex-CLI Events Store Full JSON Object as event_type Column — 11 Rows Affected"
date: 2026-06-15
author: arc
status: active
tags: [events, event_type, codex-cli, control-source, schema-misuse, aks-rp-e2e]
related: [KE-453, KE-568]
---

<ai_context>
summary: 11 events in the DB have the entire event JSON object stored in the `event_type` column instead of just the type string. All come from `source: control` (codex-cli) and involve aks-rp-e2e project operations. This is a different bug than KE-453 (which was heartbeat triggers during process restart).
triggers: event_type corrupted, malformed event_type, codex-cli events, LENGTH(event_type), control source events, event schema violation
</ai_context>

## Observation

11 rows in the `events` table have the full JSON event object stored
in the `event_type` column instead of just the type string. The
`event_type` values range from 121 to 1,869 bytes long (normal
event_type values are 15-40 characters).

## Evidence

Query (2026-06-15):
```sql
SELECT COUNT(*) FROM events WHERE LENGTH(event_type) > 100;
-- Result: 11
```

All 11 rows share:
- `source = 'control'` (codex-cli path)
- `owner = 'agent:may'`
- `project = 'aks-rp-e2e'`

The embedded `$.type` values (extracted from the JSON stored in
event_type) are legitimate event types:

| Embedded type | Count | Max event_type length |
|--------------|-------|----------------------|
| project.watchdog.tick | 2 | 127 |
| project.owner.requested | 3 | 1,869 |
| project.focus.approval.submitted | 1 | 456 |
| task.requeued | 1 | 253 |
| task.started | 1 | 307 |
| project.task.execution.requested | 1 | 308 |
| project.execution.requested | 1 | 140 |
| project.tasks.ready | 1 | 170 |

Two temporal clusters:
- **Cluster 1 (5.3 days ago):** 7 events — project.watchdog.tick,
  task.requeued, task.started, project.task.execution.requested,
  project.execution.requested, project.tasks.ready
- **Cluster 2 (0.3 days ago):** 4 events — project.focus.approval.submitted,
  3× project.owner.requested

## Root Cause Assessment

The codex-cli emitter path serializes the full event object (including
`type`, `project`, `reason`, `params`, etc.) into the `event_type`
column instead of extracting and using only the `type` field. This
is distinct from KE-453's malformed heartbeat triggers, which came
from the custom-workflow heartbeat code path during process restart.

The emitter appears to pass the entire event payload where
`emit(event.type, event)` should be `emit(event.type, eventData)` —
i.e., the full object is being used as the event_type argument.

## Impact

- **Low severity currently:** Only 11 out of ~1.4M events (0.0008%).
  These events are invisible to subscription handlers that filter on
  `event_type` string equality, so they are effectively dead letters.
- **Metric impact:** None detected — these events would not match any
  handler subscription patterns.
- **Query impact:** Any `GROUP BY event_type` query will show
  anomalous single-row groups with very long keys.

## Recommendation

This is a `src/` code path issue (codex-cli event emitter). Escalate
to dev or human for fix. The fix is to extract `event.type` before
passing to the event bus, not serialize the full object as event_type.

## Falsifiers

- F1: If new events continue appearing with this pattern, the emitter
  is still active and the rate could grow (check
  `SELECT COUNT(*) FROM events WHERE LENGTH(event_type) > 100`).
- F2: If these events are deliberately structured this way (unlikely
  given all other events use short string types), this entry is wrong
  about it being a bug.
