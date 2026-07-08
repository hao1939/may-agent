# Metric alert triage — aks-rp-e2e.process.blocked.missing-fallback-count (alert 2913)

- Alert id: `2913`
- Metric id: `aks-rp-e2e.process.blocked.missing-fallback-count`
- Judged at: `2026-07-07T04:41Z`
- Chosen operation: `waiting_with_evidence`

## Why this is waiting, not a new root-cause repair

The runtime metric row and open alert currently show a breach (`current=4`), but two fresh source-of-truth recomputes from the current project state both return `0` missing-fallback blocked tasks.

This makes the live alert best explained as unreconciled runtime sampling/alert state rather than an active task-tree defect. This session has no safe runtime write path for resolving `metric_alerts` or updating `metrics.current`, so the concrete action here is to record durable evidence and wait for the next metrics refresh/reconciliation signal.

## Evidence checked

### 1. Runtime metric row still shows the breached value

Runtime DB query result:

- `metrics.current = 4`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1783408660873`

### 2. Open alert row still exists

Runtime DB query result for open alerts:

- open alert `2913` has `resolved_at = null`
- message: `AKS RP E2E blocked tasks missing fallback is above threshold: current=4, threshold=0, target=0`

### 3. Fresh direct metric sampling now returns 0

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-fallback-count
```

Observed output:

```text
0
```

### 4. Direct blocked-leaf recompute from the current tree finds no offending task ids

Command:

```bash
cd /app/projects/aks-rp-e2e.app && node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync("tasks/tree.json","utf8")); const bad=[]; for (const [id,t] of Object.entries(data.tasks)) { if (t.state!=="blocked") continue; const b=(t.blocker&&typeof t.blocker==="object"&&!Array.isArray(t.blocker))?t.blocker:{}; const fa=((typeof b.fallback_at==="string"&&b.fallback_at.trim())||(typeof b.fallbackAt==="string"&&b.fallbackAt.trim())||""); const fx=((typeof b.fallback_action==="string"&&b.fallback_action.trim())||(typeof b.fallbackAction==="string"&&b.fallbackAction.trim())||""); if (!fa || !fx) bad.push({id,parent_id:t.parent_id,kind:t.kind,owner:t.owner,state:t.state,waiting_for:b.waiting_for,resume_condition:b.resume_condition,blocker:b}); } console.log(JSON.stringify({count:bad.length,bad},null,2));'
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
- the runtime metric and alert state have not yet caught up
- there is no safe write path in this session to resolve the runtime alert row manually
- the next metrics refresh is the correct validation point

## Next validation signal

Wait for the next `metrics-snapshot` or subsequent runtime sample for `aks-rp-e2e.process.blocked.missing-fallback-count`.

If the runtime row updates to `0` and alert `2913` resolves, treat this as reconciled stale state. If it remains `>0`, reopen only with fresh blocked task ids from a current tree recompute.
