# Metric alert triage — aks-rp-e2e.process.blocked.missing-owner-count (alert 2812)

- Alert id: `2812`
- Metric id: `aks-rp-e2e.process.blocked.missing-owner-count`
- Judged at: `2026-07-07T02:27:50Z`
- Chosen operation: `resolve_stale`

## Current measurement

The open alert reflects a stale sampled breach rather than a current blocked-leaf defect.

Runtime DB state still shows the persisted breach:

- `metrics.current = 1`
- `metrics.updated_at = 1783383269131`
- open alert row `2812` has `resolved_at = null`

But a fresh direct recompute from the current source of truth, `tasks/tree.json`, finds **no** blocked leaf whose blocker is missing `owner`.

## Live recompute evidence

Command run in `/app/projects/aks-rp-e2e.app`:

```bash
node - <<'NODE'
const fs=require('fs');
const obj=JSON.parse(fs.readFileSync('tasks/tree.json','utf8'));
for (const [id, task] of Object.entries(obj.tasks)) {
  const state = task.state || task.status;
  const children = task.children || [];
  if (children.length) continue;
  if (state !== 'blocked') continue;
  const blocker = (task.blocker && typeof task.blocker === 'object' && !Array.isArray(task.blocker)) ? task.blocker : null;
  const hasOwner = blocker && ((typeof blocker.owner === 'string' && blocker.owner.trim()) || (typeof blocker.owner === 'object' && blocker.owner));
  if (!hasOwner) {
    console.log(id);
    console.log(JSON.stringify({taskOwner: task.owner || null, blocker}, null, 2));
    console.log('---');
  }
}
NODE
```

Observed output:

```text
(no output)
```

So the current blocked-leaf missing-owner count is `0`.

## Recurrence pattern

Recent alert history for the same metric shows the same shape repeatedly:

- alert `2800` created with `current=1`, later resolved
- alert `2787` created with `current=1`, later resolved
- alert `2769` created with `current=1`, later resolved

That pattern fits a transient planner/sample timing breach rather than a durable missing-owner condition in the committed task tree.

## Judgment

`resolve_stale` is the correct operation because the current task tree no longer contains a blocked leaf missing blocker-owner metadata, so there is no safe root-cause repair to apply in this session.

This environment does not provide a safe runtime write path for `metric_alerts`, so the concrete change in this session is a durable evidence record documenting that alert `2812` should clear on the next metric refresh if the recomputed tree remains unchanged.

## Next validation signal

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.blocked.missing-owner-count`.
If the sampled value returns to `0`, alert `2812` should resolve as stale.
If it returns to `>0`, reopen only with the fresh blocked task id(s) from a new tree recompute.
