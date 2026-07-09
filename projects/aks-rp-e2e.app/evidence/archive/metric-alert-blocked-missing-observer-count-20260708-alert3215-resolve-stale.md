# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` — alert `3215`

- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Alert id: `3215`
- Final operation: `resolve_stale`
- Triage time: `2026-07-09T18:00:05.834Z`

## Judgment

This alert is stale in persisted runtime state, not a live blocked-observer defect.

The persisted metric row still reports `current=1` and the open alert row remains unresolved, but a fresh authoritative recompute now returns `value=0` with `offenderTaskIds=[]`. The only offender named by the latest stored snapshot, `hold-compact-fleet-hubless-rpapi-version-progression-frontier-20260709`, already carries the required observer contract fields in the runtime task tree:

- `blocker.observed_by`
- `blocker.observation_method`
- `blocker.next_check_at`

The supported blocked-contract repair dry run also reports `repairedCount=0`, so there is no current blocked holder left for app-ops to repair safely in this session.

## Evidence

### 1. Persisted metric row is still breaching

Runtime DB query result:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1783556965043`

### 2. Open alert row is still unresolved

Runtime DB query result:

- `id = 3215`
- `resolved_at = null`
- `message = AKS RP E2E blocked tasks missing observer is above threshold: current=1, threshold=0, target=0`

### 3. Latest persisted snapshot named one offender

Latest stored snapshot:

```json
{"value":1,"sample_size":1,"measured_at":1783556965043,"measured_by":"agent:may","note":"{\"offenderTaskIds\":[\"hold-compact-fleet-hubless-rpapi-version-progression-frontier-20260709\"]}"}
```

### 4. Fresh authoritative recompute now returns zero offenders

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result:

```json
{"measuredAt":1783557181090,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

### 5. The snapshot-named task already has the required observer contract

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree show hold-compact-fleet-hubless-rpapi-version-progression-frontier-20260709
```

Observed blocker excerpt:

```json
{
  "next_check_at": "2026-07-09T18:00:00Z",
  "observed_by": {
    "workflow": "project-planner",
    "schedule": "blocked-frontier-app-ops-review",
    "trigger": "project.planning.requested"
  },
  "observation_method": "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence."
}
```

### 6. Supported repair path finds nothing left to repair

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts --dry-run
```

Observed result excerpt:

```json
{
  "dryRun": true,
  "repairedCount": 0
}
```

## Why `resolve_stale`

`fix_root_cause` is not the right operation now because there is no current missing-observer defect left in the runtime task tree and the supported repair path has nothing to change.

`waiting_with_evidence` is also weaker than necessary here: unlike a still-contradictory live defect, the current authoritative recompute is already healthy and the exact snapshot-named blocked task is compliant. The remaining problem is stale persisted alert/metric state, not an unresolved live process defect.

This session does not have a safe runtime write path to edit `metric_alerts` directly, so the durable owner action is to record the stale-state judgment and let the next metrics refresh / alert lifecycle pass converge persisted state automatically.

## Next validation

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-observer-count`.

Recovery is confirmed when:

- the persisted metric row updates to `current=0`
- `offenderTaskIds=[]` remains true on fresh recompute
- alert `3215` resolves automatically
