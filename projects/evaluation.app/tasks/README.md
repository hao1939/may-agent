# Evaluation Task Tree

The task tree represents systemic evaluation work, not individual evaluations.

Individual "evaluate session X" work is represented by a short-lived
`achieve` task while its workflow is running. After the evaluation result is
absorbed into the evaluation store, the task leaves the live graph and only a
minimal completion tombstone remains for deduplication.

Each watched project/app has one standing `maintain` task bound to the
`project-health-evaluator` workflow. A scheduled or manual event reconciles that
task; convergence means the current review is settled, not that future audits
are disabled.

The tree tracks:

- Pipeline health (is aftermath keeping up?)
- Criteria calibration (are scores consistent?)
- Drift detection (are agents changing behavior?)
- System integrity (compliance, anomalies)
- Strategy learning (what works?)
- Project/app evaluation health (are target projects moving, and are
  human-facing reports/notifications accurate?)

Task execution follows one rule:

```text
explicit task workflow -> reusable workflow
no workflow or workflow exception -> evaluation.app owner entry
```

Events wake tasks. The task tree does not schedule them. Workflow runs and
agent sessions remain runtime attempts linked to the task generation.

Project/app evaluation is human-facing. Target apps own their domain work,
self-recovery, and goal progress. `evaluation.app` checks whether that process
is visible, moving, and trustworthy.

Its reports should expose raw facts, evaluator judgment, and requested human
action. The evaluator may emit feedback for the target app, but the report and
notification are the primary outputs. Target-app problems should become
`evaluation.app` task-tree work only when the evaluation process itself needs
repair, for example missing facts, noisy notifications, or a blind spot in the
health review.
