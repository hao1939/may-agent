# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` (alert 3624)

- Date: 2026-07-14
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Alert id: `3624`
- Owner: `app-ops`

## Judgment

This specific alert is stale relative to current runtime state and has already
recovered in the live metric lifecycle.

The breach was real for a short interval (`value=1` in the two persisted samples
at `1784014157861` and `1784014483530`), but the current metric row now reports
`current=0`, alert `3624` already has a non-null `resolved_at`, and the
recovery event for the same alert was emitted at `1784014780801`. A fresh live
recompute also returns `value=0`, and the earlier offender task
`ops/wait-project-approval-owner-return-primary-blocker-20260713` now carries
`observed_by`, `observation_method`, `next_check_at`, and `fallback_at`.

So there is no present missing-observer condition for app-ops to repair. The
correct judgment for this alert instance is to acknowledge it as already
resolved stale state, not to change policy or reopen remediation.

## Evidence checked

### 1) Alert 3624 is already resolved in runtime DB

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE id = 3624;
```

Result excerpt:

- `message = "AKS RP E2E blocked tasks missing observer is above threshold: current=1, threshold=0, target=0"`
- `resolved_at = 1784014780659`
- `created_at = 1784014168609`

### 2) The metric row is currently healthy

```sql
SELECT id, current, threshold, target, priority, status, updated_at, alert_op,
       blocker, project, owner
FROM metrics
WHERE id = 'aks-rp-e2e.process.blocked.missing-observer-count';
```

Result excerpt:

- `current = 0`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`
- `updated_at = 1784014768630`
- `owner = app-ops`

### 3) Recent snapshots show a brief spike that has already decayed to zero

```sql
SELECT value, sample_size, measured_at, measured_by, note
FROM metric_snapshots
WHERE metric_id = 'aks-rp-e2e.process.blocked.missing-observer-count'
ORDER BY measured_at DESC
LIMIT 5;
```

Result excerpt:

- latest persisted sample at `1784014768630` = `0`, offenders `[]`
- prior sample at `1784014483530` = `1`, offender `ops/wait-project-approval-owner-return-primary-blocker-20260713`
- prior sample at `1784014157861` = `1`, offender `ops/wait-project-approval-owner-return-primary-blocker-20260713`
- the two earlier returned samples were already `0`

### 4) Metric lifecycle already recorded both breach and recovery for alert 3624

```sql
SELECT id, event_type, source, owner, timestamp, delivery_status,
       json_extract(data, '$.metricId') AS metricId,
       json_extract(data, '$.alertId') AS alertId,
       json_extract(data, '$.current') AS current
FROM events
WHERE event_type IN ('metric.breach', 'metric.recovered')
  AND json_extract(data, '$.metricId') = 'aks-rp-e2e.process.blocked.missing-observer-count'
  AND timestamp >= 1784014168609
ORDER BY timestamp DESC
LIMIT 10;
```

Result excerpt:

- `metric.recovered` at `1784014780801` for `alertId = 3624`, `current = 0`
- `metric.breach` at `1784014168910` for `alertId = 3624`, `current = 1`

### 5) Fresh live recompute is healthy now

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result:

```json
{"measuredAt":1784014826520,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

### 6) The earlier offender task currently has observer metadata present, and no blocked task is missing it

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun -e 'const fs=require("fs");const obj=JSON.parse(fs.readFileSync(".state/tasks/tree.json","utf8"));const needle="ops/wait-project-approval-owner-return-primary-blocker-20260713";let match=null;const missing=[];const walk=(n)=>{if(Array.isArray(n)){for(const x of n) walk(x);return;} if(!n||typeof n!=="object") return; const isTask=typeof n.id==="string"; const status=n.status??n.state; const blocker=n.blocker; if(isTask && status==="blocked" && !(blocker&&blocker.observed_by&&blocker.observation_method)) missing.push(n.id); if(isTask && n.id===needle) match=n; for(const v of Object.values(n)) walk(v);}; walk(obj); console.log(JSON.stringify({missingObserverTaskIds:missing, offenderTask:match?{id:match.id,status:match.status??match.state,blocker:{observed_by:match.blocker?.observed_by||null,observation_method:match.blocker?.observation_method||null,next_check_at:match.blocker?.next_check_at||null,fallback_at:match.blocker?.fallback_at||null}}:null},null,2));'
```

Observed result excerpt:

- `missingObserverTaskIds = []`
- offender task `ops/wait-project-approval-owner-return-primary-blocker-20260713` is still `blocked`
- blocker now includes non-empty `observed_by`
- blocker now includes non-empty `observation_method`
- blocker includes `next_check_at = 2026-07-14T22:00:00Z`
- blocker includes `fallback_at = 2026-07-15T04:00:00Z`

## Why this is `resolve_stale`

- The current source of truth is healthy (`metrics.current = 0`).
- The alert row itself is no longer open (`resolved_at` is set).
- The event stream already recorded `metric.recovered` for alert `3624`.
- Fresh live recompute and direct runtime-tree audit both show no blocked task
  missing observer metadata.
- The metric remains useful because it captured a real transient breach; this
  alert instance is simply already resolved.

## Next validation

Next validation point: the next `metrics-snapshot` should continue to keep
`aks-rp-e2e.process.blocked.missing-observer-count` at `0`. If a later sample
returns `>0`, that would be a fresh breach rather than unfinished work from
alert `3624`.
