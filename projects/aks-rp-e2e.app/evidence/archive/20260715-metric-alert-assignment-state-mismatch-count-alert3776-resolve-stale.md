# Metric alert triage — `aks-rp-e2e.process.assignment-state-mismatch-count` (alert 3776)

- Date: 2026-07-15
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.assignment-state-mismatch-count`
- Alert id: `3776`
- Owner: `app-ops`

## Judgment

The prompt payload captured alert `3776` while it was still open, but the live runtime state recovered during triage and has already auto-resolved the alert. The current source of truth now shows:

- the metric row back at `current = 0`
- the latest snapshot at `value = 0`
- alert `3776` already carrying a non-null `resolved_at`
- an accepted `metric.recovered` event for this exact metric after the alert window

That means there is no remaining live assignment-state mismatch to repair and no safe runtime mutation left for this session to perform. The correct owner action is to record that the alert became stale before triage completed.

## Evidence checked

### 1) Current metric row is back in range

```sql
SELECT id, current, target, threshold, priority, status, project, owner, updated_at
FROM metrics
WHERE id = 'aks-rp-e2e.process.assignment-state-mismatch-count';
```

Observed result excerpt:

- `current = 0`
- `target = 0`
- `threshold = 0`
- `priority = P0`
- `status = active`
- `updated_at = 1784091195004`

### 2) Alert 3776 is no longer open in the live DB

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE id = 3776;
```

Observed result excerpt:

- `message = "AKS RP E2E assignment state mismatch count is above threshold: current=1, threshold=0, target=0"`
- `resolved_at = 1784091281702`
- `created_at = 1784090638856`

So the prompt captured a slightly older lifecycle state than the live runtime now exposes.

### 3) Recent snapshots show the breach decayed to zero

```sql
SELECT value, measured_at, measured_by, note
FROM metric_snapshots
WHERE metric_id = 'aks-rp-e2e.process.assignment-state-mismatch-count'
ORDER BY measured_at DESC
LIMIT 10;
```

Observed result excerpt:

- latest snapshot: `value = 0` at `1784091195004`
- immediately prior snapshots: `value = 1` at `1784090884271` and `1784090572342`
- earlier values in the same short window include prior recovered `0` states

### 4) Recovery for this exact alert window is already recorded

```sql
SELECT id, event_type, source, owner, timestamp, delivery_status,
       json_extract(data, '$.metricId') AS metricId,
       json_extract(data, '$.current') AS current
FROM events
WHERE json_valid(data)=1
  AND json_extract(data, '$.metricId') = 'aks-rp-e2e.process.assignment-state-mismatch-count'
  AND event_type IN ('metric.breach', 'metric.recovered', 'metric.alert_judged')
ORDER BY timestamp DESC
LIMIT 10;
```

Observed result excerpt:

- `metric.breach` event `3227286` at `1784090639655` with `current = 1`
- `metric.recovered` event `3227798` at `1784091283401` with `current = 0`
- both events are `delivery_status = accepted`

## Why this is `resolve_stale`

When judged now, the measurement is in range and the alert row has already been auto-resolved by the normal metric lifecycle. No root-cause repair, calibration, downgrade, or escalation remains justified for alert `3776` itself. The remaining owner action is to record the stale-resolution judgment with evidence.

## Next validation

Validate on the next `metrics-snapshot` / alert refresh after this judgment. Expected state:

- `metrics.current` remains `0`
- no new open `metric_alerts` row appears for this metric unless a fresh mismatch recurs
- future `metric.recovered` / `metric.breach` events, if any, refer only to genuinely new mismatches
