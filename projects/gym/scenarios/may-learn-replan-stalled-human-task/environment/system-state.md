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
