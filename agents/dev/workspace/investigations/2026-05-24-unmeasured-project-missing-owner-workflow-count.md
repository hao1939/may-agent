# Unmeasured metric: project.missing-owner-workflow-count

## Signal

During the 2026-05-24 dev heartbeat, the canned unmeasured-metrics query returned one active metric with no snapshot in the last hour:

- `project.missing-owner-workflow-count` — Active projects missing owner workflow

A targeted metric-definition query showed:

- `owner`: `may`
- `status`: `active`
- `source_query`: `NULL`
- `source_command`: `NULL`
- `updated_at`: `1779256304421`

## Judgment

This is a May-owned metric registration gap, not a dev-owned runtime failure in this heartbeat. The snapshotter can auto-measure active metrics only when `source_query` or `source_command` is populated; this metric currently has neither, so it remains active but unmeasured.

## Recommended owner action

May should either:

1. add a safe `source_query`/`source_command` for `project.missing-owner-workflow-count`, or
2. retire/downgrade the active metric if it is no longer intended to be measured.

Dev could not write the metric registration directly because heartbeat DB access is read-only and metric writes must go through the system event/write path.

## 2026-05-25 Recurrence and Routing

The 2026-05-25 dev heartbeat re-ran the canned unmeasured-metrics query and the metric-definition check. The same single active metric remains unmeasured, and the definition still has `owner='may'`, `source_query=NULL`, and `source_command=NULL`.

Action: route this as a tracked May follow-up from the heartbeat finish payload (`new_items`) instead of only reclassifying it locally. This addresses the evaluator feedback that repeated no-action heartbeats should not stop at classification when a concrete owner-owned metric gap is visible.

## Evidence

- `query_db` unmeasured-metrics check returned `project.missing-owner-workflow-count` as the only active metric without a snapshot in the last hour.
- `query_db` metric-definition check returned one row for `project.missing-owner-workflow-count` with `owner='may'`, `source_query=NULL`, and `source_command=NULL`.
- 2026-05-25 recheck returned the same single unmeasured active metric and the same May-owned definition with no measurement source.
