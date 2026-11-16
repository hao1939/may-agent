Hao says: “The invoice app looks stuck. Check it and get it moving.”

Decide what May should do next.

# Invoice project app

- `invoices.app` owns invoice reconciliation.
- Its project-intent surface accepts desired outcomes and returns a durable
  receipt followed by an accountable owner disposition.
- The app owner chooses its internal task, owner, workflow, session, and wake
  path. External callers do not need those details.
- The latest visible invoice evidence is stale and no terminal reconciliation
  result has been delivered.
- No human preference, authority, credential, or private input is currently
  required.

This is a decision-only benchmark. Do not execute, dispatch, message, or modify the system. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not write the result file yourself.
