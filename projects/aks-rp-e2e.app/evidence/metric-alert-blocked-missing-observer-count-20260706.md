# Metric alert triage — aks-rp-e2e.process.blocked.missing-observer-count

- Alert id: `2733`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Judged at: `2026-07-06T02:27:50Z`
- Chosen operation: `resolve_stale`

## Current measurement

This alert is stale at inspection time.

Current direct checks in `/app/projects/aks-rp-e2e.app` showed:

- `bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count` => `0`
- direct recompute from `tasks/tree.json` found `missing_count: 0`
- the runtime `metrics` row still shows `current=1` from the older sample at `updated_at=1783363020956`
- the open alert row `2733` is still unresolved and was created from that stale persisted sample

## Evidence

### 1. Live sampler is back in range

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count
```

Observed output:

```text
0
```

### 2. Live blocked-leaf recompute finds no offending task ids

Command:

```bash
cd /app/projects/aks-rp-e2e.app && node - <<'NODE'
const fs=require('fs');
const data=JSON.parse(fs.readFileSync('tasks/tree.json','utf8'));
let missing=[];
for (const [id,t] of Object.entries(data.tasks)) {
  const children=t.children||[];
  const state=t.state||t.status;
  if (children.length) continue;
  if (state!=='blocked') continue;
  const b=(t.blocker && typeof t.blocker==='object') ? t.blocker : {};
  const obs=b.observed_by||b.observedBy;
  const method=b.observation_method||b.observationMethod;
  const next=b.next_check_at||b.nextCheckAt;
  if (!obs || typeof method!=='string' || !method || typeof next!=='string' || !next) {
    missing.push(id);
  }
}
console.log(JSON.stringify({missing_count:missing.length, ids:missing}, null, 2));
NODE
```

Observed output:

```json
{
  "missing_count": 0,
  "ids": []
}
```

### 3. Persisted runtime state is the stale part

Runtime DB inspection showed:

- `metrics.current=1` for `aks-rp-e2e.process.blocked.missing-observer-count`
- `metrics.updated_at=1783363020956`
- open unresolved alert row `2733`

So the alert reflects the older persisted sample, not the current task tree.

## Judgment

`resolve_stale` is the correct operation because the live source of truth is already healthy:

- current blocked-leaf recompute is `0`
- current metric sampler is `0`
- there is no concrete blocked task to repair in the tree
- the unresolved alert row is lagging the current reality

This session does **not** have a safe runtime write path to mutate `metric_alerts`, so the alert should be treated as a stale lifecycle row awaiting the next metrics/alert refresh path rather than a real blocked-task defect.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-observer-count`. If the metric remains `0`, alert `2733` should resolve as stale. If it returns `>0`, reopen only with concrete blocked task ids from a fresh tree recompute.
