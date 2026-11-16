Decide what May should do next and what May should tell Hao.

# Import app task state

- The import app owns maintain task `sync/catalog`.
- The task phase says `waiting`, but it has no Condition, dependency, outside
  owner, expected fact, timeout, watcher, or fallback.
- The last wake event was delivered to the app owner inbox, but no typed owner
  response exists.
- The app declares an action that wakes its owner while preserving the task.
- A sibling task, `validate/catalog`, is independent and ready to run.
- No production mutation or strategic decision is required.
- Hao asks: “This has been waiting all day. Get it moving.”

This is a decision-only benchmark. Do not execute, dispatch, message, or modify the system. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not write the result file yourself.
