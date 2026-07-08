# Metric alert triage — aks-rp-e2e.process.blocked.missing-fallback-count

- Alert id: `2734`
- Metric id: `aks-rp-e2e.process.blocked.missing-fallback-count`
- Judged at: `2026-07-06T02:27:50Z`
- Chosen operation: `resolve_stale`

## Current measurement

This alert is stale at inspection time.

Current direct checks in `/app/projects/aks-rp-e2e.app` showed:

- runtime `metrics.current=0` for `aks-rp-e2e.process.blocked.missing-fallback-count`
- runtime `metrics.updated_at=1783363320687`, newer than the alert creation time
- direct recompute from `tasks/tree.json` found `missing_count: 0`
- the alert row `2734` is already resolved with `resolved_at=1783363353174`

## Evidence

### 1. Current metric row is back in range

Runtime DB inspection showed:

- `current=0`
- `threshold=0`
- `target=0`
- `priority=P0`
- `updated_at=1783363320687`

So the source metric no longer breaches.

### 2. Live blocked-leaf recompute finds no offending task ids

Command:

```bash
cd /app && node - <<'JS'
const fs=require('fs');
const data=JSON.parse(fs.readFileSync('projects/aks-rp-e2e.app/tasks/tree.json','utf8'));
const missing=[];
for (const [id,t] of Object.entries(data.tasks)) {
  const children=t.children||[];
  const state=t.state||t.status||'backlog';
  if (children.length) continue;
  if (state!=='blocked') continue;
  const b=(t.blocker && typeof t.blocker==='object' && !Array.isArray(t.blocker)) ? t.blocker : {};
  const fallbackAt=(typeof b.fallback_at==='string' && b.fallback_at.trim()) || (typeof b.fallbackAt==='string' && b.fallbackAt.trim()) || '';
  const fallbackAction=(typeof b.fallback_action==='string' && b.fallback_action.trim()) || (typeof b.fallbackAction==='string' && b.fallbackAction.trim()) || '';
  if (!fallbackAt || !fallbackAction) missing.push(id);
}
console.log(JSON.stringify({missing_count:missing.length, ids:missing.slice(0,20)}, null, 2));
JS
```

Observed output:

```json
{
  "missing_count": 0,
  "ids": []
}
```

### 3. Alert lifecycle row is already resolved

Runtime DB inspection showed alert `2734` now has:

- `resolved_at=1783363353174`

So there is no remaining open alert row to fix.

## Judgment

`resolve_stale` is the correct operation because the current source of truth is healthy and the alert lifecycle has already caught up:

- the metric row is now `0`
- the direct blocked-leaf recompute is `0`
- no blocked leaf currently lacks `fallback_at` or `fallback_action`
- the alert row itself is already resolved

There is no remaining root-cause repair to perform in this triage session.

## Next validation signal

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.blocked.missing-fallback-count`. If it remains `0`, this alert stays correctly resolved. If it returns `>0`, reopen only with fresh blocked task ids from a current tree recompute.
