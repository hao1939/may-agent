# Evaluation Task Tree

The task tree represents systemic evaluation work, not individual evaluations.

Individual "evaluate session X" is a workflow execution that writes to the DB.
It is NOT a task tree node.

Individual "review project/app X once" is also a workflow execution that writes
an evaluation report. It is NOT a task tree node unless the project/app
evaluation process itself needs repair.

The tree tracks:
- Pipeline health (is aftermath keeping up?)
- Criteria calibration (are scores consistent?)
- Drift detection (are agents changing behavior?)
- System integrity (compliance, anomalies)
- Strategy learning (what works?)
- Project/app evaluation health (are target projects moving, and are
  human-facing reports/notifications accurate?)

Project/app evaluation is human-facing. Target apps own their domain work,
self-recovery, and goal progress. `evaluation.app` checks whether that process
is visible, moving, and trustworthy.

Its reports should expose raw facts, evaluator judgment, and requested human
action. The evaluator may emit feedback for the target app, but the report and
notification are the primary outputs. Target-app problems should become
`evaluation.app` task-tree work only when the evaluation process itself needs
repair, for example missing facts, noisy notifications, or a blind spot in the
health review.
