# Metric alert triage — aks-rp-e2e.process.blocked.missing-owner-count (alert 2935)

- Alert id: `2935`
- Metric id: `aks-rp-e2e.process.blocked.missing-owner-count`
- Judged at: `2026-07-07T04:41:28Z`
- Chosen operation: `resolve_stale`
- Metric owner: `aks-explorer`

## Current measurement

The persisted runtime metric row and open alert still show a breach, but the live metric source and direct task-tree scan both show that the current missing-owner count is already back to `0`.

Persisted runtime state at triage time:

- `metrics.current = 6`
- `metrics.threshold = 0`
- `metrics.target = 0`
- `metrics.priority = P0`
- `metrics.updated_at = 1783414312882`
- open alert row `2935` has `resolved_at = null`

## Live recompute evidence

Metric source command:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-owner-count --json
```

Observed result:

```json
{ "measuredAt": 1783414597779, "value": 0 }
```

Task-tree verification command:

```bash
cd /app/projects/aks-rp-e2e.app && node - <<'NODE'
const fs=require('fs');
const data=JSON.parse(fs.readFileSync('tasks/tree.json','utf8'));
const missing=[];
for (const [id,task] of Object.entries(data.tasks)) {
  if ((task.children||[]).length) continue;
  if ((task.state||task.status) !== 'blocked') continue;
  const blocker = task.blocker && typeof task.blocker === 'object' && !Array.isArray(task.blocker) ? task.blocker : null;
  const owner = blocker && typeof blocker.owner === 'string' ? blocker.owner.trim() : '';
  if (!owner) missing.push({id, taskOwner: task.owner || null, blocker});
}
console.log(JSON.stringify({count: missing.length, sample: missing.slice(0,10)}, null, 2));
NODE
```

Observed result:

```json
{
  "count": 0,
  "sample": []
}
```

A broader blocked-task scan of the current tree also reports no blocked task without a task owner:

```json
{
  "states": {
    "review": 5,
    "done": 22,
    "blocked": 128
  },
  "blockedNoOwnerCount": 0,
  "blockedNoOwner": []
}
```

## Recurrence pattern

Recent alert history for this metric shows repeated short-lived stale breaches:

- alert `2935` open now with sampled `current=6`
- alert `2919` resolved after sampled `current=1`
- alert `2857` resolved after sampled `current=5`
- alert `2816` resolved after sampled `current=1`
- alert `2812` resolved after sampled `current=1`
- alert `2800` resolved after sampled `current=1`

This pattern fits transient sampling/runtime drift rather than a durable blocked-owner defect in the accepted task tree.

## Judgment

`resolve_stale` is the correct final operation because the current metric source of truth is already in range and there is no blocked leaf presently missing blocker-owner metadata to repair.

This session does not have a safe runtime write path for `metric_alerts`, so the concrete change made here is this durable evidence record documenting that alert `2935` should clear on the next metrics refresh if the recomputed tree remains unchanged.

## Next validation signal

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.blocked.missing-owner-count`.
If the sampled value returns to `0`, alert `2935` should resolve as stale.
If it returns to `>0`, reopen only with the fresh blocked contributor task id(s) from a new tree recompute.
