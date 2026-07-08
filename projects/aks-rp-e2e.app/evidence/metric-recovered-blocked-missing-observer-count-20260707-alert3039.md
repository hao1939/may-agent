# Metric recovery review — `aks-rp-e2e.process.blocked.missing-observer-count` (alert 3039)

- Alert id: `3039`
- Event type: `metric.recovered`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Judged at: `2026-07-07T13:13:10Z`
- Chosen operation: `no_change_needed`

## Recovery assessment

This recovery does **not** require a task-tree edit, metric-definition change, or owner-context update.

Current state is aligned:

- the recovery event reports `current = 0`
- the persisted metric row now shows `current = 0`
- alert `3039` is already resolved
- a fresh metric recompute returned `{"value":0}`
- a fresh runtime blocked-task audit found `0` blocked tasks missing observer metadata

## Evidence checked

### 1. Metric definition still matches the intended blocked-contract rule

From `scripts/project-metrics.ts`:

```ts
"aks-rp-e2e.process.blocked.missing-observer-count": () => ({
  value: tasks.blockedMissingObserver,
}),
```

From `scripts/register-project-metrics.ts`:

```ts
{
  id: "aks-rp-e2e.process.blocked.missing-observer-count",
  name: "AKS RP E2E blocked tasks missing observer",
  type: "gauge",
  target: 0,
  threshold: 0,
  unit: "count",
  alertOp: ">",
  priority: "P0",
  description:
    "P0 process signal: a blocked leaf does not say who checks the wait, how they check it, or when the next check happens. Add observed_by, observation_method, and next_check_at or reopen the work.",
}
```

So the metric contract itself does not need to change.

### 2. Persisted metric row is healthy

```sql
SELECT id, current, threshold, target, status, updated_at, alert_op
FROM metrics
WHERE id = 'aks-rp-e2e.process.blocked.missing-observer-count';
```

Observed row:

- `current = 0`
- `threshold = 0`
- `target = 0`
- `status = active`
- `alert_op = >`
- `updated_at = 1783463348347`

### 3. Alert 3039 is already resolved

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE id = 3039;
```

Observed row:

- `id = 3039`
- `resolved_at = 1783463383655`
- message reports the prior breach as `current=1`

### 4. Fresh live recompute is healthy

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result:

```json
{ "measuredAt": 1783463408237, "value": 0 }
```

### 5. Fresh runtime task-tree audit is healthy

```bash
cd /app/projects/aks-rp-e2e.app && node - <<'NODE'
const fs=require('fs');
const obj=JSON.parse(fs.readFileSync('.state/tasks/tree.json','utf8'));
const missing=[];
for (const [tid,t] of Object.entries(obj.tasks||{})) {
  if (t.state==='blocked') {
    const b=t.blocker||{};
    if (!b.observed_by || !b.observation_method || !b.next_check_at) {
      missing.push({task_id:tid,parent_id:t.parent_id,owner:t.owner??null});
    }
  }
}
console.log(JSON.stringify({blocked_missing_observer_count:missing.length,task_ids:missing},null,2));
NODE
```

Observed result:

```json
{
  "blocked_missing_observer_count": 0,
  "task_ids": []
}
```

## Decision

Leave the project/task tree, metric definition, and owner context unchanged.

This recovered event is best interpreted as confirmation that the earlier blocked-contract repair path already worked and that persisted metric state, alert state, and live runtime state are now aligned again.

## Next trigger

Only act again if a future fresh recompute returns `>0` and identifies concrete blocked task ids missing observer metadata, or if a future breach appears while direct audit and recompute both still show `0`, which would indicate sampler/persistence drift rather than a task-tree contract defect.
