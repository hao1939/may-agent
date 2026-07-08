# Metric recovery review — `aks-rp-e2e.process.blocked.missing-waiting-for-count` (alert 3038)

- Alert id: `3038`
- Event type: `metric.recovered`
- Metric id: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Judged at: `2026-07-07T13:13:10Z`
- Chosen operation: `no_change_needed`

## Recovery assessment

This recovery does **not** require a task-tree edit, metric-definition change, or owner-context update.

The current state is now internally consistent:

- the recovery event reports `current = 0`
- a fresh direct blocked-leaf audit of `projects/aks-rp-e2e.app/tasks/tree.json` found `missingCount = 0`
- a fresh direct blocked-leaf audit of `projects/aks-rp-e2e.app/.state/tasks/tree.json` found `missingCount = 0`
- a fresh metric recompute returned `{"value":0}` for `aks-rp-e2e.process.blocked.missing-waiting-for-count`

## Related prior evidence

Earlier same-day triage for this alert family already recorded why the owner should **not** churn the tree when the sampler and direct audits disagree:

- `evidence/metric-alert-blocked-missing-waiting-for-count-20260707-alert3038.md`

That breach review found a sampler contradiction: direct audits were already clean while the metric CLI still returned `value=1`. This recovered event is therefore best interpreted as confirmation that the underlying blocked-task contract is currently healthy and the sampler has re-aligned.

## Evidence checked

### 1) Fresh direct blocked-leaf audits are clean

Command:

```bash
cd /app/projects/aks-rp-e2e.app && node -e 'const fs=require("fs"); for (const file of ["tasks/tree.json",".state/tasks/tree.json"]) { const data=JSON.parse(fs.readFileSync(file,"utf8")); const bad=[]; for (const [id,t] of Object.entries(data.tasks||{})) { const s=t.state||t.status; const children=Array.isArray(t.children)?t.children:[]; const b=(t.blocker&&typeof t.blocker==="object"&&!Array.isArray(t.blocker))?t.blocker:null; const wf=b&&(b.waiting_for??b.waitingFor); const missing=!wf || (typeof wf==="object"&&!Array.isArray(wf)&&Object.keys(wf).length===0); if (s==="blocked" && children.length===0 && missing) bad.push(id); } console.log(JSON.stringify({file,missingCount:bad.length,bad},null,2)); }'
```

Observed result:

```json
{
  "file": "tasks/tree.json",
  "missingCount": 0,
  "bad": []
}
{
  "file": ".state/tasks/tree.json",
  "missingCount": 0,
  "bad": []
}
```

### 2) Fresh metric recompute now returns `0`

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-waiting-for-count --json
```

Observed result:

```json
{ "measuredAt": 1783463411175, "value": 0 }
```

### 3) Metric definition still matches the intended contract

The metric remains wired to the blocked-leaf wait-target contract in `scripts/project-metrics.ts`:

```ts
"aks-rp-e2e.process.blocked.missing-waiting-for-count": () => ({
  value: tasks.blockedMissingWaitingFor,
}),
```

So there is no evidence that the threshold or definition should change.

## Decision

Leave the project/task tree and metric definition unchanged.

- No blocked leaf currently lacks `blocker.waiting_for`
- The metric definition still matches the intended blocked-holder contract
- No owner-context memory update is needed because this recovery simply confirms the transient contradiction has cleared

## Next validation trigger

Only act again if a future nonzero sample names a real blocked leaf missing `waiting_for`, or if a future breach reappears while fresh direct audits still show `0`, which would again indicate sampler drift rather than a task-tree contract defect.
