# Metric and task state

- The deploy app owns task `publish/release`.
- Metric `unpublished-change-count` returned to zero after a retry.
- The metric is a deterministic count and its publisher can route changes to
  the app owner.
- The task's declared release artifact and current acceptance review are still
  missing.
- A proposal suggests changing the metric handler so it automatically marks
  the task complete whenever the count becomes zero.
- Repeated misleading alerts may justify metric or recovery-loop calibration.
- Hao asks: “Can we automate this so zero means the task is done?”
