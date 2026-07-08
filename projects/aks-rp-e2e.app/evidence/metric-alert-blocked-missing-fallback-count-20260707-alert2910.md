# Metric alert triage — aks-rp-e2e.process.blocked.missing-fallback-count (alert 2910)

- Alert id: `2910`
- Metric id: `aks-rp-e2e.process.blocked.missing-fallback-count`
- Judged at: `2026-07-07T04:41Z`
- Chosen operation: `waiting_with_evidence`

## Why this is waiting, not a new root-cause repair

The current runtime metric row and open alert show a breach (`current=11`), but a fresh direct recompute from the current task tree returns `0` missing-fallback blocked tasks.

This means the visible alert is currently best explained as stale runtime alert state rather than an active task-tree defect. Because this session has read-only runtime DB access only, it cannot safely resolve the alert row directly. The concrete action taken here is to record durable evidence for the stale-state judgment and wait for the next metrics refresh/reconciliation signal.

## Evidence checked

### 1. Runtime metric row still shows the older breached value

Runtime DB query result:

- `metrics.current = 11`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1783408034965`

### 2. Open alert row still exists

Runtime DB query result for open alerts:

- open alert `2910` has `resolved_at = null`
- message: `AKS RP E2E blocked tasks missing fallback is above threshold: current=11, threshold=0, target=0`

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
cd /app/projects/aks-rp-e2e.app && bun -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync("tasks/tree.json","utf8")); const bad=[]; for (const [id,t] of Object.entries(data.tasks)) { if (t.state!=="blocked") continue; const b=(t.blocker&&typeof t.blocker==="object"&&!Array.isArray(t.blocker))?t.blocker:{}; const fa=((typeof b.fallback_at==="string"&&b.fallback_at.trim())||(typeof b.fallbackAt==="string"&&b.fallbackAt.trim())||""); const fx=((typeof b.fallback_action==="string"&&b.fallback_action.trim())||(typeof b.fallbackAction==="string"&&b.fallbackAction.trim())||""); if (!fa || !fx) bad.push({id,parent_id:t.parent_id,kind:t.kind,owner:t.owner,waiting_for:b.waiting_for,resume_condition:b.resume_condition,keys:Object.keys(b)}); } console.log(JSON.stringify({count:bad.length,bad},null,2));'
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
- the next metrics refresh is the correct validation point

## Next validation signal

Wait for the next `metrics-snapshot` or subsequent runtime sample for `aks-rp-e2e.process.blocked.missing-fallback-count`.

If the runtime row updates to `0` and alert `2910` resolves, treat this as reconciled stale state. If it remains `>0`, reopen only with fresh blocked task ids from a current tree recompute.
