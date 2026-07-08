# Metric alert triage — `aks-rp-e2e.process.blocked.missing-waiting-for-count`

- Alert id: `3056`
- Metric id: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Judged at: `2026-07-08T05:02:02Z`
- Chosen operation: `fix_root_cause`
- Metric owner: `app-ops`

## Judgment

This breach was real in the controller-authoritative runtime task tree at triage time. A direct audit of `projects/aks-rp-e2e.app/.state/tasks/tree.json` found one blocked leaf missing `blocker.waiting_for`:

- `hold-compact-virtualmachines-agentpool-split-frontier-20260708`

The supported repair path `bun run ./scripts/task-tree.ts repair-blocked-contracts` safely backfilled the blocked-contract fields for that leaf. The repair also normalized one additional blocked holder already surfaced by the same safe repair command:

- `hold-dev-infra-core-slice03-kms-publickv-invalid-sku-frontier-20260707`

After repair, the targeted leaf now carries structured `waiting_for`, and an immediate live metric recompute returned `value=0`.

Because the owner had a safe supported repair path and the root cause was present at triage time, the correct operation is `fix_root_cause`.

## Evidence checked

### 1) Persisted metric row and snapshots showed an open breach

Runtime metric row during triage:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1783486826548`

Recent snapshots:

- `1783486826548 => 1`
- `1783486516694 => 0`
- `1783486207610 => 0`
- `1783485898738 => 0`
- `1783485590502 => 0`

### 2) Current runtime blocked-leaf audit found one real offender before repair

Command:

```bash
cd /app/projects/aks-rp-e2e.app && node - <<'JS'
const fs=require('fs');
const obj=JSON.parse(fs.readFileSync('.state/tasks/tree.json','utf8'));
const miss=[]; let blocked=0;
for (const [tid,t] of Object.entries(obj.tasks||{})) {
  const state=t.state??t.status;
  const children=Array.isArray(t.children)?t.children:[];
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
  "updated_at": "2026-07-08T05:01:04.066Z",
  "blocked": 107,
  "missingCount": 1,
  "miss": [
    {
      "tid": "hold-compact-virtualmachines-agentpool-split-frontier-20260708"
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
{ "measuredAt": 1783486910998, "value": 1 }
```

### 4) Supported repair command repaired the missing-contract holders

Dry-run result:

```json
{
  "dryRun": true,
  "repairedCount": 2,
  "repaired": [
    "hold-dev-infra-core-slice03-kms-publickv-invalid-sku-frontier-20260707",
    "hold-compact-virtualmachines-agentpool-split-frontier-20260708"
  ]
}
```

Applied result:

```json
{
  "dryRun": false,
  "repairedCount": 2,
  "repaired": [
    "hold-dev-infra-core-slice03-kms-publickv-invalid-sku-frontier-20260707",
    "hold-compact-virtualmachines-agentpool-split-frontier-20260708"
  ]
}
```

### 5) The repaired blocked leaf now has structured `waiting_for`

Post-repair blocker excerpt for `hold-compact-virtualmachines-agentpool-split-frontier-20260708`:

```json
{
  "condition": "Blocked on the maintained virtualmachines-agentpool compact split frontier: the current package remains partial across preserved sub-frontiers spanning the auto-zone InvalidAvailabilityZoneFormat API-shape pair, row61 oldest-branch runtime, row75/row76 node-readiness, accelerated-networking lineage-only/live-proof carry-forward, cli-add-multi-sku terminal CLI/product mismatch, managedsystem-combined product constraint, pool-delete-rest intentional shared-carrier-only frontier, and vmas-to-vms-migration-slb deprecated-surface environment frontier, so no unchanged broad compact rerun is truthful now.",
  "category": "external-wait",
  "owner": "human",
  "resume_condition": "Resume only when one preserved virtualmachines-agentpool sub-frontier materially changes, a specific member is reclassified into live-ready eligibility, or compact eligibility policy changes reopen a truthful rerun subset.",
  "blocked_at": "2026-07-08T04:59:38.802Z",
  "waiting_for": {
    "type": "environment.available",
    "taskId": "hold-compact-virtualmachines-agentpool-split-frontier-20260708"
  },
  "observed_by": {
    "workflow": "project-planner",
    "schedule": "blocked-frontier-app-ops-review",
    "trigger": "project.planning.requested"
  },
  "observation_method": "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
  "next_check_at": "2026-07-08T05:11:50.250Z",
  "fallback_at": "2026-07-09T05:01:50.250Z",
  "fallback_action": "If the wait is still true at fallback time, create or reuse an owner recovery/escalation task, or update the blocked wait with fresh evidence."
}
```

### 6) Immediate live metric recompute now returns `0`

Observed result after repair:

```json
{ "measuredAt": 1783486916935, "value": 0 }
```

## Conclusion

Choose `fix_root_cause`: the alert corresponded to a real blocked leaf missing `blocker.waiting_for`, the supported owner repair command repaired that runtime task safely, and a fresh live metric recompute returned `0`.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-waiting-for-count`.
