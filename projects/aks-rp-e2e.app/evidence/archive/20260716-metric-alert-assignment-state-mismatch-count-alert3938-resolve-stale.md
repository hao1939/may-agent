# Metric alert triage — `aks-rp-e2e.process.assignment-state-mismatch-count` (alert 3938)

- Date: 2026-07-16
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.assignment-state-mismatch-count`
- Alert id: `3938`
- Owner: `app-ops`

## Judgment

The alert was open in the prompt payload, but a fresh source-command recompute during triage showed the live metric had already recovered to `0` with no remaining mismatch contributors. The persisted `metrics.current` row and open alert were therefore lagging the live task/runtime state rather than describing an active assignment-pair problem.

To reconcile persisted state through the supported control plane, I emitted `trigger.metrics-snapshot` from `/app` with `may-agent --emit`. After that snapshot cycle completed, the runtime `metrics` row updated to `current = 0` and alert `3938` gained a non-null `resolved_at`.

## Evidence checked

### 1) Prompt-time persisted state was still breaching

```sql
SELECT id, owner, priority, current, target, threshold, alert_op, updated_at
FROM metrics
WHERE id = 'aks-rp-e2e.process.assignment-state-mismatch-count';
```

Observed before reconciliation:

- `current = 1`
- `target = 0`
- `threshold = 0`
- `priority = P0`
- `updated_at = 1784204486420`

Open alert row before reconciliation:

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE metric_id = 'aks-rp-e2e.process.assignment-state-mismatch-count'
ORDER BY created_at DESC
LIMIT 1;
```

Observed before reconciliation:

- `id = 3938`
- `resolved_at = null`
- `created_at = 1784203511797`

### 2) Fresh live source-command recompute was already healthy

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.assignment-state-mismatch-count -- --json
```

Observed output during triage:

```json
{"measuredAt":1784204920184,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"mismatches\":[]}"}
```

Companion integrity sample also returned `0`:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.integrity.task-tree-problem-count -- --json
```

Observed output:

```json
{"measuredAt":1784204920337,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

This proved there was no longer a live assignment-state mismatch to repair.

### 3) Supported reconciliation trigger was emitted

```bash
cd /app && may-agent --emit trigger.metrics-snapshot '{}'
cd /app && DAEMON_INSTANCE=background may-agent --emit trigger.metrics-snapshot '{}'
```

Observed output:

```text
Event emitted: trigger.metrics-snapshot
Event emitted: trigger.metrics-snapshot
```

### 4) Persisted state caught up after the snapshot cycle

```sql
SELECT id, current, updated_at
FROM metrics
WHERE id = 'aks-rp-e2e.process.assignment-state-mismatch-count';
```

Observed after reconciliation:

- `current = 0`
- `updated_at = 1784204814906`

```sql
SELECT id, resolved_at, created_at
FROM metric_alerts
WHERE metric_id = 'aks-rp-e2e.process.assignment-state-mismatch-count'
ORDER BY created_at DESC
LIMIT 1;
```

Observed after reconciliation:

- `id = 3938`
- `resolved_at = 1784204982981`
- `created_at = 1784203511797`

## Why this is `resolve_stale`

By the time I judged the alert, the live source of truth was already in range (`value = 0`, `mismatches = []`). The remaining issue was stale persisted lifecycle state, not a still-live runtime pair mismatch. Emitting the supported `trigger.metrics-snapshot` control-plane event reconciled the lagging metric/alert rows without any direct DB mutation.

## Next validation

Use the next `metrics-snapshot` / alert refresh after this judgment. Expected state:

- `metrics.current` remains `0`
- alert `3938` remains resolved
- a new alert should appear only if a fresh assignment-pair mismatch is sampled again
