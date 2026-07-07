# Metric alert triage — aks-rp-e2e.process.blocked.missing-owner-count (alert 2857)

- Alert id: `2857`
- Metric id: `aks-rp-e2e.process.blocked.missing-owner-count`
- Judged at: `2026-07-07T02:27:50Z`
- Chosen operation: `resolve_stale`

## Current measurement

The open alert reflects a stale sampled breach rather than a current blocked-leaf defect.

Runtime DB state at triage time still shows the persisted breach:

- `metrics.current = 5`
- `metrics.threshold = 0`
- `metrics.target = 0`
- `metrics.priority = P0`
- `metrics.updated_at = 1783396522039`
- open alert row `2857` has `resolved_at = null`

But a fresh direct recompute from the current source of truth, `tasks/tree.json`, finds **no** blocked leaf missing owner metadata.

## Live recompute evidence

Metric source command from the runtime metric row:

```bash
bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-owner-count
```

Direct recompute result:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-owner-count --json
{"measuredAt":1783396802917,"value":0}
```

Task-tree scan used to verify the contributor set:

```bash
cd /app/projects/aks-rp-e2e.app && node - <<'NODE'
const fs=require('fs');
const obj=JSON.parse(fs.readFileSync('tasks/tree.json','utf8'));
let missing=[];
for (const [id,task] of Object.entries(obj.tasks)) {
  const state = task.state || task.status;
  if ((task.children||[]).length) continue;
  if (state !== 'blocked') continue;
  const blocker = task.blocker && typeof task.blocker === 'object' && !Array.isArray(task.blocker) ? task.blocker : null;
  const owner = blocker && typeof blocker.owner === 'string' ? blocker.owner.trim() : '';
  if (!owner) missing.push({id, taskOwner: task.owner || null, blocker});
}
console.log(JSON.stringify({count: missing.length, sample: missing.slice(0,10)}, null, 2));
NODE
```

Observed output:

```json
{
  "count": 0,
  "sample": []
}
```

## Recurrence pattern

Recent alert history for the same metric shows repeated short-lived stale breaches:

- alert `2857` is currently open
- alert `2816` resolved
- alert `2812` resolved
- alert `2800` resolved
- alert `2787` resolved
- alert `2769` resolved

This pattern fits a transient planner/sample timing breach rather than a durable missing-owner condition in the accepted task tree.

## Judgment

`resolve_stale` is the correct operation because the current task tree and direct metric source both show the metric is already back in range, so there is no safe root-cause repair to apply in this session.

This environment does not provide a safe runtime write path for `metric_alerts`, so the concrete change in this session is this durable evidence record documenting that alert `2857` should clear on the next metric refresh if the recomputed tree remains unchanged.

## Next validation signal

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.blocked.missing-owner-count`.
If the sampled value returns to `0`, alert `2857` should resolve as stale.
If it returns to `>0`, reopen only with the fresh blocked task id(s) from a new tree recompute.
