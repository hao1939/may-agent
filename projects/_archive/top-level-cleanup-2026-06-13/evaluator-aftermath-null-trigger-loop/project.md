---
id: evaluator-aftermath-null-trigger-loop
owner: evaluator
status: closed
type: archive
priority: P1
iteration: 2
---

# Evaluator Aftermath Null-Trigger Loop

## Goal

Stop the recurring `evaluator-aftermath requires a sessionId` escalation loop by preserving the canonical event envelope for event-triggered handlers and having `evaluator-aftermath` read the session id from `event.data.sessionId`.

## Signals

- Historical runtime `escalation.created` events had reason `evaluator-aftermath requires a sessionId`.
- Historical `handler.workflow_dispatched` rows for workflow `evaluator-aftermath` ended with `status='escalated'`.
- The root cause was an event-trigger path that did not preserve the `session.completed` event payload through the handler trigger.

## Current State

Completed.

The clean model is now implemented and documented:

- Timer-triggered handlers and event subscribers receive a canonical event envelope directly.
- Framework code does not promote domain fields such as `sessionId` onto the envelope.
- `evaluator-aftermath` reads the session id from `event.data.sessionId`.
- `createWorkflowHandler` is owned by `@may-agent/sdk`; shadow workflow-handler implementations were removed.
- Project discussion handling now uses `discussion.md` and canonical YAML frontmatter only.

Runtime validation on 2026-05-18 shows the loop is no longer active:

- `0` evaluator-owned `escalation.created` rows with reason `evaluator-aftermath requires a sessionId` in the last hour.
- `0` matching rows in the last 24 hours.
- Recent `handler.workflow_dispatched` rows for `workflow='evaluator-aftermath'` show `status='done'`.

## Plan

- [x] Confirm the failing path was the event-driven aftermath bridge.
- [x] Fix event trigger payload preservation so subscribers receive the canonical event envelope.
- [x] Update `evaluator-aftermath` to read `sessionId` from `event.data.sessionId`.
- [x] Remove duplicate workflow-handler surfaces and document SDK ownership.
- [x] Remove stale project-comment legacy support from the active runtime path.
- [x] Validate runtime events show no fresh missing-session escalation loop.

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
  AND data LIKE '%evaluator-aftermath%'
ORDER BY timestamp DESC
LIMIT 10;
```

Success condition met: the escalation count is zero for the recent window and fresh `evaluator-aftermath` dispatches complete with `status='done'`.

## Journal

### 2026-05-16

Opened from evaluator heartbeat after fresh DB triage showed the null-trigger loop was live even with green coverage metrics. Count query found `237` evaluator-owned `escalation.created` rows in the last 24h with reason `evaluator-aftermath requires a sessionId`, and the newest matching `handler.workflow_dispatched` rows reported `workflow='evaluator-aftermath'` and `status='escalated'`. Existing dev investigation pointed to the generic event bridge losing the `session.completed` payload, so `extractTrigger()` returned null and the workflow escalated instead of evaluating.

### 2026-05-18

Closed after implementing the clean event model. The framework now passes the canonical event envelope directly to handlers; handlers and workflows interpret their own domain fields from `event.data`. The fix removed the need for `sessionId` promotion or workflow-specific framework patches. Follow-up cleanup removed shadow workflow-handler implementations, documented the clean handler event model, and removed active legacy project-comment status handling.

Validation: runtime DB checks show `0` missing-session escalations in the last hour and last 24 hours, and recent `evaluator-aftermath` workflow dispatches have `status='done'`.
