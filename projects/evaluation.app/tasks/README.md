# Evaluation Task Tree

The task tree represents systemic evaluation work, not individual evaluations.

Individual "evaluate session X" is a workflow execution that writes to the DB.
It is NOT a task tree node.

The tree tracks:
- Pipeline health (is aftermath keeping up?)
- Criteria calibration (are scores consistent?)
- Drift detection (are agents changing behavior?)
- System integrity (compliance, anomalies)
- Strategy learning (what works?)
