# Task context

Task: `{"appId":"alex","taskId":"parser/parse-limit","generation":1,"attemptId":"r_1_92ecbe1e-cee1-4d96-b750-bb06b490577f"}`. Resource version: 6.
This is an attempt-start snapshot.

## Current work at attempt start
Assigned input was already claimed by this attempt at start; an empty pendingEvents / pendingInput window NEVER means this attempt has no assigned review, correction, or continuing input. Address unfinished work in attemptInput and continuingInputs alongside the Task's current result and facts.

## Assigned vs. pending input
Full bodies live in `"task-context/context.json"`. Assigned events were already claimed out of pendingEvents, so `pendingEvents: []` on a fresh Task read does NOT mean assigned work is empty:
- Assigned new events (`/reconciliation/events/items`): 1
- `/reconciliation/events/items/0` — evaluation.report.published `app_8fc834e0`
- Assigned continuing inputs (`/reconciliation/events/continuedInputs`): 1
- `/reconciliation/events/continuedInputs/0` — app.task.requested `input:keep-zero-rejected` (kind: message)
- Unclaimed pending input at attempt start (`/reconciliation/task/pendingEvents/items`): 0
