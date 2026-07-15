# Metric alert triage — `aks-rp-e2e.process.assignment-state-mismatch-count` (alert 3679)

- Date: 2026-07-14
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.assignment-state-mismatch-count`
- Alert id: `3679`
- Owner: `app-ops`

## Judgment

This alert was a transient assignment-state mismatch that had already recovered by the time of bounded triage. The prompt payload still showed alert `3679` as open with `resolved_at = null`, but the live runtime state now shows:

- the metric row back at `current = 0`
- a fresh live recompute returning `value = 0`
- only active `project.task` pair-runs still open
- alert `3679` already auto-resolved with a non-null `resolved_at`
- a matching accepted `metric.recovered` event for alert `3679`

That means the concrete stale-state resolution already happened in the runtime lifecycle; the owner action here is to record the judgment with evidence instead of attempting any ad hoc DB mutation.

## Evidence checked

### 1) Current metric row is back in range

```sql
SELECT id, current, threshold, target, priority, status, updated_at, blocker, project, source_command, alert_op
FROM metrics
WHERE id = 'aks-rp-e2e.process.assignment-state-mismatch-count';
```

Observed result excerpt:

- `current = 0`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`
- `updated_at = 1784045996617`

### 2) Alert 3679 is no longer open in the live DB

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE id = 3679;
```

Observed result excerpt:

- `message = "AKS RP E2E assignment state mismatch count is above threshold: current=1, threshold=0, target=0"`
- `resolved_at = 1784046080213`
- `created_at = 1784045733479`

So the prompt captured a slightly older lifecycle state than the live runtime now exposes.

### 3) Recent snapshots show a one-sample spike that has already decayed to zero

```sql
SELECT value, sample_size, measured_at, measured_by, note
FROM metric_snapshots
WHERE metric_id = 'aks-rp-e2e.process.assignment-state-mismatch-count'
ORDER BY measured_at DESC
LIMIT 10;
```

Observed result excerpt:

- latest snapshot: `value = 0` at `1784045996617`
- immediately prior snapshot: `value = 1` at `1784045674627`
- the earlier returned snapshots in the same window were all `0`

### 4) Recovery for this exact alert window is already recorded

```sql
SELECT id, event_type, source, owner, timestamp, delivery_status,
       json_extract(data, '$.metricId') AS metricId,
       json_extract(data, '$.current') AS current,
       json_extract(data, '$.alertId') AS alertId
FROM events
WHERE event_type IN ('metric.breached','metric.recovered','metric.alert_judged')
  AND json_extract(data, '$.metricId') = 'aks-rp-e2e.process.assignment-state-mismatch-count'
  AND timestamp >= 1784045674627
ORDER BY timestamp DESC
LIMIT 20;
```

Observed result:

- `event_type = metric.recovered`
- `id = 3186717`
- `timestamp = 1784046080333`
- `delivery_status = accepted`
- `current = 0`
- `alertId = 3679`

### 5) Fresh live recompute also returns zero with no mismatch contributors

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.assignment-state-mismatch-count --json
```

Observed result:

```json
{"measuredAt":1784046103281,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"mismatches\":[]}"}
```

### 6) Remaining open assignment pairs match current active tasks

```sql
SELECT correlation_key, status, owner, opened_at, expected_close_at, closed_at, note
FROM event_pair_runs
WHERE pair_name = 'project.task'
  AND status IN ('open','orphan')
ORDER BY opened_at DESC
LIMIT 20;
```

Observed result excerpt:

- `ops/repair-focus-controller-redispatch-gap-20260714:a_ops_repair-focus-controller-redispatch-gap-20260714_20260714161917`
- `ops/repair-nonapproval-escalation-open-lineage-closure-20260714:a_ops_repair-nonapproval-escalation-open-lineage-closure-20260714_20260714161551`

Current task-tree summary shows those exact tasks in `frontier.active`, so they are not mismatch offenders.

### 7) Current task-tree summary aligns with the open pair list

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree summary
```

Observed result excerpt:

```json
{
  "roots": ["project"],
  "frontier": {
    "active": [
      "ops/repair-focus-controller-redispatch-gap-20260714",
      "ops/repair-nonapproval-escalation-open-lineage-closure-20260714"
    ],
    "review": [],
    "waiting": ["ops/harden-nonapproval-escalation-open-shape-20260714"],
    "runnable": []
  }
}
```

## Why this is `resolve_stale`

The measurement itself no longer breaches and the alert row has already auto-resolved. No safe root-cause mutation remains for this session to perform, and no calibration or downgrade is justified. The correct owner action is to record that alert `3679` was a transient lifecycle spike that the runtime already cleared.

## Next validation

Validate on the next `metrics-snapshot` / alert refresh after this judgment. Expected state:

- `metrics.current` remains `0`
- no new open `metric_alerts` row appears for this metric unless a fresh mismatch recurs
- fresh recomputes continue to return `sampleSize = 0` with `mismatches = []`
