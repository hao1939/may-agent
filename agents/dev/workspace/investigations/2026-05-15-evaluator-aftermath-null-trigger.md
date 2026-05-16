# Evaluator Aftermath Null-Trigger Escalation Loop

## Signal

During the 2026-05-15 dev heartbeat, the pending inbox included two recent `escalation.created` events. Querying recent events showed both were evaluator-owned escalations with reason `evaluator-aftermath requires a sessionId` and `context.trigger:null`.

A 24h count query found `141` such escalations:

```sql
SELECT COUNT(*) AS c
FROM events
WHERE event_type='escalation.created'
  AND data LIKE '%evaluator-aftermath requires a sessionId%'
  AND timestamp > (unixepoch()*1000 - 86400000);
```

## Root Cause

The event-driven `evaluator-aftermath` cron entry uses the generic `run-workflow` bridge with `includeEvent:true`:

```json
{
  "name": "evaluator-aftermath",
  "handler": "run-workflow",
  "on": ["session.completed"],
  "handlerConfig": {
    "workflow": "evaluator-aftermath",
    "agent": "evaluator",
    "task": "Evaluate the completed session...",
    "includeEvent": true
  }
}
```

The generic bridge appends a trigger block only when the handler receives a non-null `event`:

```ts
function appendEvent(task: string, event: unknown): string {
  if (!event) return task;
  return `${task}\n\n## Trigger Event\n...`;
}
```

Runtime `session.completed` rows are present and pending, but the current handler invocation path is sometimes calling `run-workflow` with no event payload. In that path, `evaluator-aftermath` receives only the static task text, `extractTrigger()` returns null, and the workflow escalates instead of evaluating the completed session.

The 7-minute `session-aftermath-scan` fallback builds its own trigger with the concrete `sessionId`, so evaluation still has a recovery path. This is why core metrics remain green despite the escalation noise.

## Disposition

This heartbeat did not patch code because the minimal safe fix needs a test around the generic event bridge or a dedicated session-completed workflow bridge. The active signal is non-red and has fallback coverage, so it is a follow-up candidate rather than an emergency.

Recommended fix: make the event-driven `evaluator-aftermath` path derive the trigger from the actual `session.completed` event (or skip dispatch when no event is available) and add a regression test that `ctx.sdk.runWorkflow('evaluator-aftermath', task)` receives a task containing `## Trigger Event` with `data.sessionId` when a `session.completed` event is supplied.
