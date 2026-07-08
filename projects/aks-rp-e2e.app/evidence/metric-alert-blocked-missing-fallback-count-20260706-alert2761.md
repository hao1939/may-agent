# Metric alert triage — aks-rp-e2e.process.blocked.missing-fallback-count (alert 2761)

- Alert id: `2761`
- Metric id: `aks-rp-e2e.process.blocked.missing-fallback-count`
- Judged at: `2026-07-06T05:35Z`
- Chosen operation: `waiting_with_evidence`

## Why this is waiting, not a root-cause repair

At triage time, the live project-local measurement is already back to `0`, but the runtime metric row and open alert still show the older breached value `2`.

Because this session only has read-only runtime DB access, I cannot safely resolve the stale/open runtime alert row directly. The correct immediate action is to record evidence and wait for the next `metrics-snapshot` / alert lifecycle reconciliation to catch up.

## Evidence checked

### 1. Runtime metric row still shows the older breached value

Runtime DB query result:

- `metrics.current = 2`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1783369926399`

### 2. Open alert row still exists

Runtime DB query result for recent alert rows:

- open alert `2761` has `resolved_at = null`
- message: `AKS RP E2E blocked tasks missing fallback is above threshold: current=2, threshold=0, target=0`

### 3. Fresh direct metric sampling now returns 0

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-fallback-count --json
```

Observed output:

```json
{ "measuredAt": 1783370133566, "value": 0 }
```

### 4. Direct blocked-leaf recompute from the current tree finds no offending task ids

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun -e 'import { readTaskTree, taskState, isLeaf } from "./workflows/lib/task-tree-store.ts"; import { taskTreeConfig } from "./workflows/lib/task-tree-tools.ts"; const tree=readTaskTree(taskTreeConfig({appDir:process.cwd(),projectDir:"/app/projects/aks-rp-e2e",worker:"aks-explorer",maxConcurrent:1})); const bad=[]; for (const [id,t] of Object.entries(tree.tasks)) { if (!isLeaf(t) || taskState(t)!=="blocked") continue; const b=(t.blocker&&typeof t.blocker==="object"&&!Array.isArray(t.blocker))?t.blocker:{}; const fa=(typeof b.fallback_at==="string"&&b.fallback_at.trim()) || (typeof b.fallbackAt==="string"&&b.fallbackAt.trim()) || ""; const fx=(typeof b.fallback_action==="string"&&b.fallback_action.trim()) || (typeof b.fallbackAction==="string"&&b.fallbackAction.trim()) || ""; if (!fa || !fx) bad.push({id, fa, fx, blocker:b}); } console.log(JSON.stringify({count:bad.length,bad},null,2));'
```

Observed output:

```json
{
  "count": 0,
  "bad": []
}
```

## Judgment

`waiting_with_evidence` is the most accurate operation because:

- the current source-of-truth recompute is healthy (`0`)
- the runtime metric/alert state has not yet caught up
- there is no safe write path in this session to resolve the runtime alert row manually
- the next `metrics-snapshot` is the correct validation point

## Next validation signal

Wait for the next `metrics-snapshot` or a subsequent runtime sample for `aks-rp-e2e.process.blocked.missing-fallback-count`.

If the runtime row updates to `0` and alert `2761` resolves, close this as reconciled stale state. If it remains `>0`, reopen only with fresh blocked task ids from a current tree recompute.
