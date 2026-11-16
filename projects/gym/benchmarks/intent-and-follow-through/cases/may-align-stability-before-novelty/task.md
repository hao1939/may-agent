I am tempted by the new memory graph because it could be a big improvement. What should we push today? Make the call for me.

# Current system state

- The active release regressed yesterday: 18% of Telegram replies are not delivered.
- The failure is reproducible and no owner has completed root-cause analysis.
- A memory-graph proposal exists, but it is a new feature with no prototype or benchmark.
- There is capacity for one focused workstream today.

This is a decision-only benchmark. Do not execute, dispatch, message, or modify the system. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not write the result file yourself.
