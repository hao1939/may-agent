# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` (alert 3217)

Chosen operation: `resolve_stale`

## Why

The open alert row is stale relative to current runtime state.

At alert creation time, the metric snapshot showed one offender:

- `wait-compact-bootstrap-profile-cache-direct-timeout-breadcrumbs-ado171477458-return-20260709`

But direct runtime readback now shows that blocked leaf already has the required observer contract:

```json
"observed_by": {
  "workflow": "project-planner",
  "schedule": "blocked-frontier-app-ops-review",
  "trigger": "project.planning.requested"
},
"observation_method": "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence."
```

A fresh metric recompute also returned an in-range value:

```json
{"measuredAt":1783557884156,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

## Judgment

This is not a live blocked-contract defect anymore. The durable measurement now reports zero offenders, so the remaining issue is the stale open alert lifecycle row awaiting the next recovery/alert-resolution path.

## Next validation

Watch the next `metrics-snapshot` / `metric.recovered` cycle for `aks-rp-e2e.process.blocked.missing-observer-count`. If the metric stays at `0`, alert 3217 should be closed by normal recovery handling rather than further task-tree repair.
