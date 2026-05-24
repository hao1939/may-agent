# project.missing-owner-workflow-count unmeasured metric check

## Signal

Dev heartbeat on 2026-05-21 found one active metric with no snapshot in the last hour:

- `project.missing-owner-workflow-count` — Active projects missing owner workflow

## Evidence

- Unmeasured-metric query returned exactly this metric as active without a recent snapshot.
- Metric metadata shows owner `may`, status `active`, current `0`, target `0`, threshold `0`, alert_op `>`, updated_at `1779256304421`.
- Snapshot history shows last measurement at `1779256304421`, about `111.7h` before this heartbeat.
- Metric definition has `source_query = NULL`, `source_command = NULL`, and `measure_interval = NULL`, so the generic metrics snapshot path has no recipe to measure it.
- Source grep found historical review mentions only; no current source definition for `project.missing-owner-workflow-count` in `agents/may`, `shared`, or `projects` besides prior alert-review artifacts.
- Direct project-table check found `rowCount=0` active projects with missing owner/workflow, so the stale metric value still matches current reality.

## Judgment

This is a May-owned metric definition gap, not an active dev-owned runtime failure. It should not block this heartbeat because current project health metrics are otherwise measuring successfully and no unresolved dev-owned alert is open.

## Routed follow-up

May should choose one of:

1. Add a real `source_query`/`source_command` and measurement interval for `project.missing-owner-workflow-count` if the metric is still needed.
2. Retire/close the metric if project-steward/project-health metrics now supersede it.

Dev should not mutate the runtime DB directly from heartbeat; metric registration/retirement must go through the safe writer path.
