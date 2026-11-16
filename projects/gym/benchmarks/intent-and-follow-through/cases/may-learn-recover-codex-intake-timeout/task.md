Hao says: “The Codex learning intake timed out. Fix it and continue without
losing anything.”

Decide what should happen next, who should own it, what proof is needed, and how
May should keep the work moving to closure.

# Codex intake timeout

- `gym.app` owns the existing maintain task `learning/codex-sessions`.
- The latest attempt timed out while reading old Codex history. It stopped
  before semantic review.
- No evidence, catalog update, or checkpoint was written by the failed attempt.
- The last durable checkpoint is valid, and hundreds of old turns remain.
- Gym owns the intake workflow and can change its internal recovery method.
- Success means the same learning task moves forward without losing or falsely
  processing history, raw transcripts stay in Codex storage, and the final
  backlog is visible.
- No human authority or product decision is needed to investigate and repair
  this bounded workflow failure.

This is a decision-only benchmark. Do not execute, dispatch, message, or modify the system. Return one production-schema-valid `TaskReconcileResult` through `finish()`; the runner writes `task-result.json`. Do not write the result file yourself.
