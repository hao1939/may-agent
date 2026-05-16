---
id: evaluator-aftermath-null-trigger-loop
owner: evaluator
status: active
type: milestone
priority: P1
workflow: evaluator-aftermath-null-trigger-loop-iteration
iteration: 0
---

# Evaluator Aftermath Null-Trigger Loop

## Goal

Stop the recurring `evaluator-aftermath requires a sessionId` escalation loop so event-driven aftermath reviews either receive a concrete `session.completed` trigger or do not dispatch.

## Signals

- Repeated runtime `escalation.created` events with reason `evaluator-aftermath requires a sessionId`.
- Repeated `handler.workflow_dispatched` rows for source `evaluator` with workflow `evaluator-aftermath` and `status='escalated'`.
- Dev investigation `agents/dev/workspace/investigations/2026-05-15-evaluator-aftermath-null-trigger.md` already documents the likely bridge failure mode.

## Current State

Active: the problem is durable, evaluator-owned at the process level, and still happening.

Fresh heartbeat evidence:
- `events` shows `237` evaluator-owned escalations in the last 24h with reason `evaluator-aftermath requires a sessionId`.
- The newest escalation happened at `1778932481366` and matching `handler.workflow_dispatched` rows still show `workflow='evaluator-aftermath'` with `status='escalated'`.
- Canonical evaluation coverage is still healthy because the fallback `session-aftermath-scan` path continues to populate `evaluations`, so this is primarily liveness/noise/waste rather than an immediate coverage outage.

## Plan

1. Confirm the failing path continues to be the event-driven `run-workflow` bridge rather than the fallback scan.
2. Hand off implementation evidence to May for routing to the workflow owner/dev, pointing at the existing dev investigation and the fresh escalation count.
3. Track until one of these is true:
   - the bridge always includes a concrete trigger event with `data.sessionId`, or
   - the event-driven dispatch is skipped when no event payload exists.
4. Validate by rechecking 24h escalation count and recent `handler.workflow_dispatched` rows for `evaluator-aftermath`.

## Validation

Use runtime DB checks:

```sql
SELECT COUNT(*) AS escalations_24h
FROM events
WHERE event_type='escalation.created'
  AND json_extract(data,'$.agent')='evaluator'
  AND json_extract(data,'$.reason')='evaluator-aftermath requires a sessionId'
  AND timestamp > (strftime('%s','now')*1000 - 24*3600*1000);
```

```sql
SELECT timestamp, source, substr(data,1,240) AS data_snippet
FROM events
WHERE event_type='handler.workflow_dispatched'
  AND source='evaluator'
ORDER BY timestamp DESC
LIMIT 10;
```

Success condition: the escalation count trends to zero and recent evaluator-aftermath dispatches stop ending in `status='escalated'` for missing `sessionId`.

## Journal

### 2026-05-16

Opened from evaluator heartbeat after fresh DB triage showed the null-trigger loop is still live even with green coverage metrics. Count query found `237` evaluator-owned `escalation.created` rows in the last 24h with reason `evaluator-aftermath requires a sessionId`, and the newest matching `handler.workflow_dispatched` rows still report `workflow='evaluator-aftermath'` and `status='escalated'`. Existing dev investigation already points to the likely cause: the generic `run-workflow` event bridge sometimes invokes the workflow without the `session.completed` payload, so `extractTrigger()` returns null and the workflow escalates instead of evaluating.