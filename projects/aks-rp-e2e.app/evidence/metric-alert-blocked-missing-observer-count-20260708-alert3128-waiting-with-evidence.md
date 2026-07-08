# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` — alert `3128`

- Operation: `waiting_with_evidence`
- Judged by: `app-ops`
- Judged at: `2026-07-08T02:41Z`

## Decision

Choose `waiting_with_evidence` because the live source of truth has already recovered, but the persisted metric row and open alert have not reconciled yet.

At triage time:

- the persisted metric row still shows `current = 1`
- the newest persisted snapshot still shows `value = 1` with offender task `review-spec-storage-csi-rerun-171343304-return-20260708`
- the current runtime task already carries the required observer contract fields
- a fresh owner-side metric recompute now returns `value = 0` with no offender task ids
- the open alert row `3128` is still unresolved and still carries the older breach message

That means there is no remaining live blocked-observer defect for me to repair in this session. The truthful owner action is to record the stale-vs-live mismatch and wait for the next metrics refresh / alert recovery cycle.

## Evidence checked

### 1) Persisted metric row still shows the breach

```sql
SELECT id, name, current, threshold, target, priority, project, status, updated_at, alert_op, source_command, blocker
FROM metrics
WHERE id = 'aks-rp-e2e.process.blocked.missing-observer-count';
```

Observed at triage time:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1783510376497`

### 2) Latest persisted snapshot still names one offender

```sql
SELECT value, sample_size, measured_at, measured_by, note
FROM metric_snapshots
WHERE metric_id = 'aks-rp-e2e.process.blocked.missing-observer-count'
ORDER BY measured_at DESC
LIMIT 10;
```

Latest row at triage time:

- `value = 1`
- `sample_size = 1`
- `measured_by = agent:may`
- `note = {"offenderTaskIds":["review-spec-storage-csi-rerun-171343304-return-20260708"]}`

The immediately previous row was healthy:

- `value = 0`
- `note = {"offenderTaskIds":[]}`

### 3) The currently named offender already has observer metadata

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree show review-spec-storage-csi-rerun-171343304-return-20260708
```

Current runtime task state includes:

- `blocker.observed_by.workflow = project-planner`
- `blocker.observed_by.schedule = blocked-frontier-app-ops-review`
- `blocker.observation_method = Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.`
- `blocker.next_check_at = 2026-07-08T18:00:00Z`
- `trace.blocked_contract_repaired_at = 2026-07-08T11:34:59.487Z`

So the currently named task no longer lacks the observer contract that this metric measures.

### 4) Fresh owner-side recompute is already healthy

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-observer-count --json
```

Result:

```json
{"measuredAt":1783510556109,"value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

This is the live source-of-truth check for the metric and it shows no current offenders.

### 5) The alert row is still open and stale relative to the live recompute

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE metric_id = 'aks-rp-e2e.process.blocked.missing-observer-count'
  AND resolved_at IS NULL
ORDER BY created_at DESC
LIMIT 5;
```

Open row at triage time:

- `id = 3128`
- `resolved_at = null`
- `message = AKS RP E2E blocked tasks missing observer is above threshold: current=1, threshold=0, target=0`

## Why this is not `fix_root_cause`

A root-cause repair would require a current blocked task that still lacks observer metadata and a safe fix I can apply now. The current runtime task already has observer metadata and the fresh metric recompute is already `0`, so there is no remaining live observer defect for me to repair in this session.

## Why this is not `resolve_stale`

The alert is stale relative to the live recompute, but this triage environment only provides read-only DB access. I cannot safely mutate `metric_alerts.resolved_at` or the persisted metric row from here. The supported owner action available in this workflow is to record the judgment and wait for the next runtime recovery cycle.

## Next validation

Validate on the next `metrics-snapshot` / alert-recovery cycle after `2026-07-08T11:35:56Z`. Recovery is confirmed when alert `3128` gains `resolved_at` or disappears from the open-alert query while fresh recompute remains `value = 0`.
