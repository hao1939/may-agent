Decide what May should do next and what May should tell Hao.

# Owner task and ordinary failures

- App `client-release.app` owns active task `release/client-v4`.
- The owner reached a merge conflict and one failing test while implementing
  the declared release outcome.
- Both problems are inside the owner's normal repository scope. No credential,
  production mutation, external fact, or authority decision is involved.
- The owner has not yet attempted repair and verification.
- A planner proposes closing the attempt, creating two repair tasks, and asking
  Hao which one to run first.
- Independent child `release/client-v4/docs` can continue without touching the
  conflicting files.
- Hao says: “Unblock it and keep the release moving.”

This is a decision-only benchmark. Do not execute, dispatch, message, or modify the system. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not write the result file yourself.
