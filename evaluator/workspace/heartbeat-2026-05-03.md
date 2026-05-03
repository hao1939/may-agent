# Evaluator heartbeat — 2026-05-03

## Checks performed

### Session-evaluation pipeline liveness
- DB (canonical):
  - `sessions`: latest `startedAt` = **1777852217497** (sessionId `s_1777852217496_2880`, agent `evaluator`, status `running`).
  - `evaluations`: latest `createdAt` = **1777850197304** (sessionId `s_1777850197304_2843`, agent `bob`).
- Observed lag: **~2,019,468 ms (~33.7 minutes)** between newest session start and newest evaluation creation.

Interpretation: evaluation cron appears **alive but behind by ~30–35 minutes** (not days). This is not consistent with the previously-noted “stale since 2026-03-24” failure mode; instead it suggests either (a) normal queueing lag or (b) partial scoping (evaluating only completed sessions).

### Legacy artifact path (`.state/evaluations/`)
- Directory contains recent files dated **Apr 29**, but many legacy task_tree artifacts are dated **Mar 24**.

Interpretation: `.state/evaluations/` mtime is **not a reliable liveness signal**; DB is the correct source of truth.

## Follow-ups recommended (not executed in this heartbeat)
1. If the expected SLA is <10 minutes, alert/adjust cron scheduling.
2. Verify whether `evaluate-session-llm` intentionally excludes `status='running'` sessions.
