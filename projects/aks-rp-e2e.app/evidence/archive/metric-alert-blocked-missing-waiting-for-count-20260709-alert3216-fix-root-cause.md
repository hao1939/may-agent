# Metric alert triage — `aks-rp-e2e.process.blocked.missing-waiting-for-count` (alert 3216)

Chosen operation: `fix_root_cause`

## Why

The breach was real at alert time and owner-fixable. A fresh metric recompute still returned value `1` and named a single blocked leaf offender:

- `wait-compact-bootstrap-profile-cache-direct-timeout-breadcrumbs-ado171477458-return-20260709`

The runtime task showed a blocked `blocker` contract with `condition`, `resume_condition`, `next_check_at`, `fallback_at`, and `fallback_action`, but it was missing the machine-readable `waiting_for` field required by the metric.

## Concrete change made

Ran the supported blocked-contract repair path:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts
```

That command reported:

```json
{
  "dryRun": false,
  "treePath": "/app/projects/aks-rp-e2e.app/.state/tasks/tree.json",
  "repairedCount": 1,
  "repaired": [
    "wait-compact-bootstrap-profile-cache-direct-timeout-breadcrumbs-ado171477458-return-20260709"
  ]
}
```

## Readback after repair

The runtime task now contains a structured wait target and observer metadata:

```json
"blocker": {
  "owner": "aks-explorer",
  "waiting_for": {
    "type": "environment.available",
    "taskId": "wait-compact-bootstrap-profile-cache-direct-timeout-breadcrumbs-ado171477458-return-20260709",
    "sourceRunId": "171477458"
  },
  "blocked_at": "2026-07-09T00:35:52.527Z",
  "observed_by": {
    "workflow": "project-planner",
    "schedule": "blocked-frontier-app-ops-review",
    "trigger": "project.planning.requested"
  },
  "observation_method": "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence."
}
```

## Contradiction still visible after repair

Two direct blocked-leaf audits over the same runtime tree now return zero missing wait targets:

- Node JSON audit over `.state/tasks/tree.json` → `count: 0`
- Bun `readTaskTree(taskTreeConfig(...))` audit over the runtime tree → `count: 0`

But `bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-waiting-for-count --json --verbose` still returned:

```json
{
  "measuredAt": 1783557726821,
  "treePath": "/app/projects/aks-rp-e2e.app/.state/tasks/tree.json",
  "value": 1,
  "sampleSize": 1,
  "note": "{\"offenderTaskIds\":[\"wait-compact-bootstrap-profile-cache-direct-timeout-breadcrumbs-ado171477458-return-20260709\"]}"
}
```

So the blocked-task contract defect was repaired, but the metric sample path has not yet converged to the repaired runtime state.

## Next validation

Watch the next `metrics-snapshot` / alert refresh. If the metric still reports the same offender after the repaired runtime tree continues to show `waiting_for`, the remaining problem is sampler/writeback drift rather than a live blocked-task contract defect.
