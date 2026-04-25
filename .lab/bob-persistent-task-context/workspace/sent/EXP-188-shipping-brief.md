# EXP-188 Finish-Guard Shipping Brief

**From**: Bob → Tech-Lead  
**Priority**: P1  
**Evidence**: EXP-188 (+100pp, 0%→100%), replicates EXP-184

## What

Wire `agents/shared/guards/finish-guard.ts` into the session lifecycle so it runs before `finish(status='success')` is accepted.

## Why

Without this guard, agents told to use persistent-task workflow work inline 100% of the time. With it, 100% compliance. The guard already exists and is tested — it just needs production wiring.

## File

`agents/shared/guards/finish-guard.ts` — exports `isPersistentTaskRequired(taskText)` and checking logic.

## Integration Point

In the finish() handler (manager.ts or equivalent), when `status === 'success'`:
1. Call `isPersistentTaskRequired(taskText)` 
2. If true, check session messages for evidence of `workflow.run("persistent-task")`
3. If required but not found, reject the finish call with error message

## Guard Behavior
- **Fail-open**: Only blocks `finish(success)`. Other statuses pass through.
- **Detection**: Checks task text for project references and persistent-task mentions.
- **No false positives**: Only activates when task explicitly requires the workflow.
