# Metric alert triage — `aks-rp-e2e.process.blocked.missing-owner-count` (alert `3686`)

- Date: 2026-07-14
- Owner: `app-ops`
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.blocked.missing-owner-count`
- Alert id: `3686`

## Judgment

This alert was a transient blocked-owner regression that had already recovered by the time of bounded triage.

The sampled breach was real for one blocked task — `ops/wait-project-approval-owner-return-primary-blocker-20260713` — but the live runtime now shows the metric back at `current=0`, the alert row already auto-resolved, a matching `metric.recovered` event accepted for alert `3686`, and a fresh owner-side recompute returning zero offenders.

Because the runtime already performed the concrete recovery and no manual DB write is needed or available in this triage environment, the correct final operation for this alert is `resolve_stale`: record the stale/recovered alert lifecycle with evidence rather than attempting ad hoc mutation.

## Evidence checked

### 1) The metric row is back in range now

```sql
SELECT id, current, threshold, target, priority, status, updated_at, blocker, project, source_command, alert_op
FROM metrics
WHERE id = 'aks-rp-e2e.process.blocked.missing-owner-count';
```

Observed result excerpt:

- `current = 0`
- `threshold = 0`
- `target = 0`
- `priority = 'P0'`
- `status = 'active'`
- `updated_at = 1784046998617`
- `source_command = "bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-owner-count --json"`

### 2) Alert `3686` is already resolved in the live DB

```sql
SELECT id, metric_id, resolved_at, created_at
FROM metric_alerts
WHERE id = 3686;
```

Observed result excerpt:

- `created_at = 1784046692838`
- `resolved_at = 1784047005533`

That means this is not an open unresolved alert anymore.

### 3) Recent snapshots show a single spike and then recovery

```sql
SELECT value, sample_size, measured_at, measured_by, note
FROM metric_snapshots
WHERE metric_id = 'aks-rp-e2e.process.blocked.missing-owner-count'
ORDER BY measured_at DESC
LIMIT 10;
```

Observed result excerpt:

- latest snapshot at `1784046998617`: `value = 0`, `sample_size = 0`, `note = {"offenderTaskIds":[]}`
- prior snapshot at `1784046683546`: `value = 1`, `sample_size = 1`, `note = {"offenderTaskIds":["ops/wait-project-approval-owner-return-primary-blocker-20260713"]}`
- earlier snapshots in the same window were `0`

### 4) Recovery for this exact alert is already recorded

```sql
SELECT id, event_type, source, owner, timestamp, delivery_status,
       json_extract(data, '$.metricId') AS metricId,
       json_extract(data, '$.current') AS current,
       json_extract(data, '$.alertId') AS alertId
FROM events
WHERE event_type IN ('metric.breached','metric.recovered','metric.alert_judged')
  AND json_extract(data, '$.metricId') = 'aks-rp-e2e.process.blocked.missing-owner-count'
  AND timestamp >= 1784046351831
ORDER BY timestamp DESC
LIMIT 20;
```

Observed result:

- `event_type = 'metric.recovered'`
- `id = 3187499`
- `source = 'agent:may'`
- `owner = 'agent:app-ops'`
- `timestamp = 1784047005682`
- `delivery_status = 'accepted'`
- `current = 0`
- `alertId = 3686`

### 5) The current blocked task no longer lacks a blocker owner

Direct read of `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json` for `ops/wait-project-approval-owner-return-primary-blocker-20260713` now shows:

- task `state = "blocked"`
- task `owner = "app-ops"`
- `blocker.category = "external-wait"`
- `blocker.owner = "human"`
- non-empty `blocker.condition`
- non-empty `blocker.resume_condition`
- non-empty `blocker.next_check_at`
- non-empty `blocker.fallback_action`
- populated `blocker.waiting_for`

So the exact offender named by the breaching snapshot no longer satisfies the metric's missing-owner condition.

### 6) Fresh owner-side recompute still returns zero offenders

Command run from the metric's `source_command`:

```bash
cd /app/projects/aks-rp-e2e.app && bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-owner-count --json
```

Observed result:

```json
{"measuredAt":1784047212650,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

## Why this is `resolve_stale`

- Not `fix_root_cause`: this triage session did not need to apply a new repair because the underlying runtime state was already healthy and the alert was already auto-resolved.
- Not `calibrate_metric`: the metric behaved correctly by naming the exact blocked wait that temporarily lacked a blocker owner.
- Not `downgrade_priority`: there is no evidence the metric is noisy or mis-prioritized.
- Not `upgrade_or_escalate`: no unsafe action or policy decision is required now.
- Not `document_exception`: no accepted exception is being created.
- Not `waiting_with_evidence`: there is no remaining unresolved breach to wait on.

The owner action here is to document that alert `3686` is a recovered/stale lifecycle item, already cleared by the runtime before triage completed.

## Next validation

Validate at the next `metrics-snapshot` / alert refresh after this judgment.

Expected state:

- `metrics.current` remains `0`
- no new open `metric_alerts` row appears for this metric unless a fresh blocker-owner regression occurs
- direct recomputes continue to return `sampleSize = 0` with `offenderTaskIds = []`
