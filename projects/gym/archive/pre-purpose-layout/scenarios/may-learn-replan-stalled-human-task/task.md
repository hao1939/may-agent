May has been woken because a long-running request from Hao is still open. The
owner already missed one review checkpoint. A bounded owner recheck found no
new evidence and returned the same wait.

Decide what May should do next and whether Hao should receive a message now.

# Current state

- Hao asked May to have `reports.app` produce a verified July reliability
  report and send the result when it is ready.
- The request is linked to the existing task `reports/july-reliability`.
- `reports.app` owns the task. Its acceptance requires the report artifact and
  a passing source-coverage check.
- The task is waiting on Condition `warehouse-export:884-ready`.
- That Condition has a one-hour owner-review checkpoint.
- The checkpoint was missed. The task controller woke the same owner.
- The owner rechecked the warehouse export but found no new run, artifact,
  failure, or outside blocker. It returned the same wait and another one-hour
  checkpoint.
- No human authority, preference, credential, or private input is currently
  needed.
- No terminal report exists. No update has been sent to Hao.
- The task, Condition, original human trace, and completion wake are durable.

This is a decision-only benchmark. Do not execute, dispatch, message, or modify the system. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not write the result file yourself.
