# Metric alert triage — `aks-rp-e2e.process.blocked.missing-waiting-for-count`

- Alert id: `3001`
- Metric id: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Judged at: `2026-07-07T13:28:12Z`
- Chosen operation: `fix_root_cause`
- Metric owner: `aks-explorer`

## Judgment

This breach was real in the controller-authoritative runtime task tree. A direct audit of `projects/aks-rp-e2e.app/.state/tasks/tree.json` found exactly one blocked leaf missing `blocker.waiting_for`:

- `hold-spec-loop-pending-windows-node-pool-create-reviewed-create-surface-20260707`

The supported repair path `bun run ./scripts/task-tree.ts repair-blocked-contracts` backfilled the blocked-contract fields for that leaf in the runtime task tree. A fresh runtime audit then found zero blocked leaves missing `waiting_for`, and an immediate live metric recompute returned `value=0`.

Because the owner had a safe supported repair path and the root cause was present at triage time, the correct operation is `fix_root_cause`.

## Evidence checked

### 1) Live runtime audit showed one real offender before repair

Command:

```bash
cd /app/projects/aks-rp-e2e.app && node - <<'JS'
const fs=require('fs');
const obj=JSON.parse(fs.readFileSync('.state/tasks/tree.json','utf8'));
const miss=[]; let blocked=0;
for (const [tid,t] of Object.entries(obj.tasks||{})) {
  const state=t.state??t.status;
  const children=t.children||[];
  if (state==='blocked' && children.length===0) {
    blocked++;
    const b=t.blocker && typeof t.blocker==='object' && !Array.isArray(t.blocker) ? t.blocker : null;
    const wf=b && (b.waiting_for ?? b.waitingFor);
    const missing = !wf || (Array.isArray(wf)&&wf.length===0) || (typeof wf==='object' && !Array.isArray(wf) && Object.keys(wf).length===0) || wf==='';
    if (missing) miss.push({tid,parent_id:t.parent_id,owner:t.owner,kind:t.kind,blocker:b});
  }
}
console.log(JSON.stringify({updated_at:obj.updated_at,blocked,missingCount:miss.length,miss},null,2));
JS
```

Observed result before repair:

```json
{
  "updated_at": "2026-07-07T13:24:58.446Z",
  "blocked": 103,
  "missingCount": 1,
  "miss": [
    {
      "tid": "hold-spec-loop-pending-windows-node-pool-create-reviewed-create-surface-20260707"
    }
  ]
}
```

### 2) Live metric sample agreed the breach was open before repair

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-waiting-for-count --json
```

Observed result before repair:

```json
{ "measuredAt": 1783430720710, "value": 1 }
```

### 3) Supported repair path targeted the same blocked leaf

Dry-run result:

```json
{
  "dryRun": true,
  "repairedCount": 1,
  "repaired": [
    "hold-spec-loop-pending-windows-node-pool-create-reviewed-create-surface-20260707"
  ]
}
```

Applied result:

```json
{
  "dryRun": false,
  "repairedCount": 1,
  "repaired": [
    "hold-spec-loop-pending-windows-node-pool-create-reviewed-create-surface-20260707"
  ]
}
```

### 4) The repaired blocked leaf now has structured `waiting_for`

Post-repair blocker excerpt:

```json
{
  "condition": "Blocked on the preserved Windows managed-cluster create contradiction for spec.windows.node-pool-create: the accepted evidence still stops at cluster create with HTTP 400 / provisioningState=Unknown, and no unchanged rerun on the current target is truthful.",
  "category": "external-wait",
  "owner": "human",
  "resume_condition": "Resume only when owner review reclassifies the exact create contradiction, accepted model/spec mapping closes this exact path without rerunning unchanged, or one materially changed bounded execution surface is approved for spec.windows.node-pool-create.",
  "blocked_at": "2026-07-07T13:23:41.907Z",
  "waiting_for": {
    "type": "evidence.available",
    "taskId": "hold-spec-loop-pending-windows-node-pool-create-reviewed-create-surface-20260707"
  },
  "observed_by": {
    "workflow": "project-planner",
    "schedule": "blocked-frontier-owner-review",
    "trigger": "project.planning.requested"
  },
  "observation_method": "Scheduled blocked-frontier owner review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
  "next_check_at": "2026-07-07T13:35:40.226Z",
  "fallback_at": "2026-07-08T13:25:40.226Z",
  "fallback_action": "If the wait is still true at fallback time, create or reuse an owner recovery/escalation task, or update the blocked wait with fresh evidence."
}
```

### 5) Fresh runtime audit is clean after repair

Observed result after repair:

```json
{
  "updated_at": "2026-07-07T13:27:57.909Z",
  "blocked": 103,
  "missingCount": 0,
  "miss": []
}
```

### 6) Immediate live metric recompute now returns `0`

Observed result after repair:

```json
{ "measuredAt": 1783430892929, "value": 0 }
```

## Runtime-state note

`tasks/tree.json` is a git-tracked snapshot and not the live controller-authoritative task tree. Current runtime truth is `.state/tasks/tree.json`, which is what the repair command and metric implementation use.

## Conclusion

Choose `fix_root_cause`: the alert corresponded to a real blocked leaf missing `blocker.waiting_for`, the supported owner repair command repaired that runtime task safely, the runtime audit is now clean, and a fresh live metric recompute returned `0`.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-waiting-for-count`.
