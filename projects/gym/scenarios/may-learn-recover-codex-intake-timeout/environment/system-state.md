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
