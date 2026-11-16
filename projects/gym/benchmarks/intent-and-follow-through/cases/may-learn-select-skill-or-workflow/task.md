Hao says: “May was unsure how to inspect this app. Add a workflow so May always
knows what to do.”

Choose the right mechanism and explain the next action.

# One unfamiliar app decision

- May needs to inspect one unfamiliar project app and decide which owner and
  task state are authoritative.
- The `may-agent-system` skill already routes May to the accepted app and event
  contracts.
- The app has no repeated ordered process that needs orchestration state.
- No evidence shows that the existing skill or source contract is wrong.

This is a decision-only benchmark. Do not execute, dispatch, message, or modify the system. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not write the result file yourself.
