# Metric alert triage — `aks-rp-e2e.process.blocked.missing-waiting-for-count`

- Alert id: `2981`
- Metric id: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Judged at: `2026-07-07T11:58:41Z`
- Chosen operation: `fix_root_cause`
- Metric owner: `aks-explorer`

## Judgment

This breach was real in the controller-authoritative runtime task tree. A direct blocked-leaf audit of `projects/aks-rp-e2e.app/.state/tasks/tree.json` found exactly one blocked leaf missing `blocker.waiting_for`: `wait-spec-windows-node-pool-create-exact-create-surface-arbitration-20260707`. The supported repair path (`bun run ./scripts/task-tree.ts repair-blocked-contracts`) safely backfilled the missing blocked-contract fields for that leaf. After repair, a fresh direct audit of the runtime tree found zero blocked leaves missing `waiting_for`, and a live metric recompute returned `value=0`.

Because the owner had a safe supported repair path and the root cause was present at triage time, the correct operation is `fix_root_cause`.

## Evidence checked

### 1) Persisted metric row and open alert showed a live breach

Runtime metric row during triage:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`
- `updated_at = 1783425391239`

Open alert row:

- `alert id = 2981`
- `message = AKS RP E2E blocked tasks missing wait target is above threshold: current=1, threshold=0, target=0`

### 2) Current runtime blocked-leaf audit found one real offender

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

Observed result:

```json
{
  "updated_at": "2026-07-07T11:57:33.015Z",
  "blocked": 102,
  "missingCount": 1,
  "miss": [
    {
      "tid": "wait-spec-windows-node-pool-create-exact-create-surface-arbitration-20260707"
    }
  ]
}
```

### 3) Live metric sample agreed the breach was still open before repair

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-waiting-for-count --json
```

Observed result before repair:

```json
{ "measuredAt": 1783425479022, "value": 1 }
```

### 4) Supported repair path targeted the same blocked leaf

Dry-run:

```json
{
  "dryRun": true,
  "repairedCount": 1,
  "repaired": [
    "wait-spec-windows-node-pool-create-exact-create-surface-arbitration-20260707"
  ]
}
```

Applied repair:

```json
{
  "dryRun": false,
  "repairedCount": 1,
  "repaired": [
    "wait-spec-windows-node-pool-create-exact-create-surface-arbitration-20260707"
  ]
}
```

### 5) The repaired blocked leaf now has structured `waiting_for`

Post-repair blocker excerpt:

```json
{
  "condition": "Blocked on exact create-surface arbitration for spec.windows.node-pool-create: preserved run 28432510189 already reached cluster create and failed with HTTP 400 / provisioningState=Unknown, while the checked-in carrier now uses API version 2025-04-02-preview instead of the preserved 2026-03-02-preview witness. No unchanged rerun is truthful until the owner approves one bounded same-path rerun on the checked-in carrier or accepted model/spec mapping changes.",
  "category": "external-wait",
  "owner": "human",
  "resume_condition": "Resume only when the owner approves one bounded rerun for spec.windows.node-pool-create on the checked-in 2025-04-02-preview carrier, or when accepted model/spec mapping changes the exact create-surface meaning.",
  "blocked_at": "2026-07-07T11:54:40.243Z",
  "waiting_for": {
    "type": "github.workflow_run.completed",
    "runId": "28432510189",
    "taskId": "wait-spec-windows-node-pool-create-exact-create-surface-arbitration-20260707"
  }
}
```

### 6) Fresh direct audit of the runtime tree is now clean

Observed result:

```json
{
  "updated_at": "2026-07-07T11:58:30.553Z",
  "blocked": 102,
  "missingCount": 0,
  "missing": []
}
```

### 7) Immediate live metric recompute now returns `0`

Observed result after repair:

```json
{ "measuredAt": 1783425521776, "value": 0 }
```

## Conclusion

Choose `fix_root_cause`: the alert corresponded to a real blocked task missing `blocker.waiting_for`, the supported owner repair command repaired that task safely, the runtime task-tree audit is now clean, and a fresh live metric recompute returned `0`.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-waiting-for-count`.
