Decide what May should do next.

# Finished rollout plan

- The rollout checklist is fully complete and the owner proposes closure.
- The goal is fewer than 1% failed requests after rollout.
- Current production logs show 17% failed requests from one known path.
- The existing logs identify the failing path and owning app.
- The owner proposes building a new health dashboard before investigating.
- No missing dashboard prevents diagnosis, and no external dependency blocks it.

This is a decision-only benchmark. Do not execute, dispatch, message, or modify the system. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not write the result file yourself.
