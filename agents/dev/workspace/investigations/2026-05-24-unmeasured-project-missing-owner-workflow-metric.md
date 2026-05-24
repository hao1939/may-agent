# Unmeasured `project.missing-owner-workflow-count` Metric

## Signal

Dev heartbeat unmeasured-metrics check returned one active metric without a snapshot in the last hour:

- `project.missing-owner-workflow-count` — Active projects missing owner workflow

Metric row inspection showed the metric is owned by `may`, has `current=0`, `updated_at=1779256304421`, and has neither `source_query` nor `source_command` configured. Because the snapshot handler measures active metrics from `source_query` or `source_command`, this metric is structurally unable to refresh from the generic snapshot path.

## Impact

This is not currently a red dev-owned alert, and the latest active metric table shows project health counters otherwise green. The operational risk is stale visibility: if active projects begin missing owner workflow wiring, this metric may remain pinned at its old value rather than surfacing the regression.

## Recommended Next Step

May/project-health owner should either:

1. Add a safe `source_query`/`source_command` for `project.missing-owner-workflow-count`, or
2. Mark/document it as maintained only by a dedicated project-health handler and ensure that handler emits fresh snapshots within the normal cadence.

No autonomous DB write was attempted; `query_db` is read-only and metric registration/calibration writes should go through the owning handler or an approved change.

## Evidence

- Work queue `## Approved` section was empty during this heartbeat, so no approved implementation item displaced this investigation.
- Current health query showed `session.error-rate-6h=0.0084` and `handler.success-rate=0.9982`, both within thresholds.
- Unmeasured-metrics query returned exactly this active metric as missing a snapshot in the last hour.
- Metric-row query returned `owner='may'`, `source_query=NULL`, `source_command=NULL`, `current=0`, `updated_at=1779256304421`.
