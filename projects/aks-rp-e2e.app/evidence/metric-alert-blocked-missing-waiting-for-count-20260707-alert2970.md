# Metric alert triage — `aks-rp-e2e.process.blocked.missing-waiting-for-count`

- Alert id: `2970`
- Metric id: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Judged at: `2026-07-07T11:15:55Z`
- Chosen operation: `fix_root_cause`
- Metric owner: `aks-explorer`

## Judgment

This breach was real in the controller-authoritative runtime task tree. A direct blocked-leaf audit of `projects/aks-rp-e2e.app/.state/tasks/tree.json` found exactly two blocked leaves missing `blocker.waiting_for`, and the supported repair path (`bun run ./scripts/task-tree.ts repair-blocked-contracts`) repaired both blocker contracts safely. After repair, a fresh direct audit of the runtime tree found zero blocked leaves missing `waiting_for`.

The persisted metric row and latest snapshot still show `current=2`, so the next metrics refresh remains the validation signal for alert recovery. But the owner-side root cause that this metric is designed to catch — blocked leaves missing `blocker.waiting_for` — was concretely fixed in this session.

## Evidence checked

### 1) Persisted metric row and latest snapshot showed the breach

Runtime metric row during triage:

- `current = 2`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`
- `updated_at = 1783422835775`

Latest snapshots:

- `1783422835775 => 2`
- `1783422519440 => 0`
- `1783422201303 => 4`
- `1783421885667 => 0`
- `1783421569573 => 4`

### 2) Current runtime blocked-leaf audit found two real offenders

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
  "updated_at": "2026-07-07T11:15:08.099Z",
  "blocked": 101,
  "missingCount": 2,
  "miss": [
    {
      "tid": "normalize-private-cluster-terminal-runs-28671841561-28840446579-owner-wr-2"
    },
    {
      "tid": "reconcile-spec-loop-pending-traffic-azure-service-mesh-5-blocked"
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
{ "measuredAt": 1783422942998, "value": 2 }
```

### 4) Supported repair command repaired the exact blocked holders

Dry-run first showed the same two targets:

```json
{
  "dryRun": true,
  "repairedCount": 2,
  "repaired": [
    "normalize-private-cluster-terminal-runs-28671841561-28840446579-owner-wr-2",
    "reconcile-spec-loop-pending-traffic-azure-service-mesh-5-blocked"
  ]
}
```

Applying the supported repair:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts
```

Observed result:

```json
{
  "dryRun": false,
  "repairedCount": 2,
  "unchangedCount": 99,
  "repaired": [
    "normalize-private-cluster-terminal-runs-28671841561-28840446579-owner-wr-2",
    "reconcile-spec-loop-pending-traffic-azure-service-mesh-5-blocked"
  ]
}
```

### 5) The repaired runtime tasks now have structured `waiting_for`

Post-repair blocker excerpts:

- `normalize-private-cluster-terminal-runs-28671841561-28840446579-owner-wr-2`
  - `waiting_for.type = evidence.available`
  - `waiting_for.taskId = normalize-private-cluster-terminal-runs-28671841561-28840446579-owner-wr-2`
- `reconcile-spec-loop-pending-traffic-azure-service-mesh-5-blocked`
  - `waiting_for.type = evidence.available`
  - `waiting_for.taskId = reconcile-spec-loop-pending-traffic-azure-service-mesh-5-blocked`

### 6) Fresh direct audit of the runtime tree is now clean

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
    if (missing) miss.push(tid);
  }
}
console.log(JSON.stringify({updated_at:obj.updated_at,blocked,missing:miss},null,2));
JS
```

Observed result:

```json
{
  "updated_at": "2026-07-07T11:15:55.772Z",
  "blocked": 101,
  "missing": []
}
```

## Conclusion

Choose `fix_root_cause`: the alert corresponded to real blocked tasks missing `blocker.waiting_for`, the supported owner repair command repaired those tasks safely, and the runtime task-tree audit is now clean even though alert recovery still depends on the next metrics refresh.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-waiting-for-count`.
