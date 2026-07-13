# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` — alert `3540`

- Judged at: `2026-07-13T12:59:00Z`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Alert id: `3540`
- Chosen operation: `waiting_with_evidence`

## Judgment

This alert is currently waiting on the next persisted metrics refresh, not on a new blocked-contract repair.

The persisted runtime metric row and open alert still show a breach (`current=1`), and the newest persisted snapshot names exactly one offender:

- `ops/wait-project-approval-owner-return-primary-blocker-20260713`

However, the live task-tree state now shows that blocker has a complete observer contract again, including `observed_by`, `observation_method`, and `next_check_at`. Its trace also records `blocked_contract_repaired_at = 2026-07-13T12:58:03.352Z`, which is later than the breaching snapshot and alert creation. A fresh live metric recompute now returns `value=0` with no offenders.

That means the alert reflects lagging persisted state. I do not have a safe runtime write path in this session to resolve the alert row manually, so the correct process move is to wait for the next `metrics-snapshot` / alert recovery cycle to reconcile the persisted tables.

## Evidence checked

### 1. Persisted metric row still shows the breach

`metrics` row for `aks-rp-e2e.process.blocked.missing-observer-count`:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1783947414588`

### 2. Open alert `3540` is still unresolved

`metric_alerts` row:

- `id = 3540`
- `resolved_at = null`
- `created_at = 1783947421260`

### 3. Latest persisted breaching snapshot named one offender

Newest snapshot:

```json
{"value":1,"sample_size":1,"measured_at":1783947414588,"measured_by":"agent:may","note":"{\"offenderTaskIds\":[\"ops/wait-project-approval-owner-return-primary-blocker-20260713\"]}"}
```

### 4. Live task-tree now shows the blocker repaired

Supported live command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree show ops/wait-project-approval-owner-return-primary-blocker-20260713
```

Current output includes:

```json
"next_check_at": "2026-07-14T00:40:00Z",
"observed_by": {
  "workflow": "project-planner",
  "schedule": "blocked-frontier-app-ops-review",
  "trigger": "project.planning.requested"
},
"observation_method": "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence."
```

and:

```json
"blocked_contract_repaired_at": "2026-07-13T12:58:03.352Z"
```

### 5. Fresh live metric recompute is healthy now

Supported live metric command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result:

```json
{"measuredAt":1783947581483,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

## Why `waiting_with_evidence`

There is no remaining live missing-observer defect for app-ops to repair safely in this session. The source-of-truth runtime tree already recovered, but the persisted metric row and alert lifecycle have not yet caught up. Because I only have read-only DB access here, the truthful final operation is `waiting_with_evidence` until the next automated metrics persistence / alert recovery cycle validates the recovery.

## Next validation

Watch the next `metrics-snapshot` cycle for:

- `metrics.current = 0` on `aks-rp-e2e.process.blocked.missing-observer-count`, and
- automatic recovery / resolution of alert `3540`.
