# Metric alert triage — `aks-rp-e2e.process.blocked.missing-waiting-for-count`

- Alert id: `2958`
- Metric id: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Judged at: `2026-07-07T10:45:50Z`
- Chosen operation: `fix_root_cause`
- Metric owner: `aks-explorer`

## Judgment

This breach was real in the controller-authoritative runtime task tree. A direct blocked-leaf audit of `projects/aks-rp-e2e.app/.state/tasks/tree.json` found exactly one blocked leaf missing `blocker.waiting_for`, and the supported repair path (`bun run ./scripts/task-tree.ts repair-blocked-contracts`) repaired that blocker contract safely. After repair, a fresh direct audit of the runtime tree found zero blocked leaves missing `waiting_for`.

The metric CLI still returned `value=1` immediately after the repair, so the next metrics refresh remains the validation signal for alert recovery. But the owner-side root cause that this metric is designed to catch — a blocked leaf missing `blocker.waiting_for` — was concretely fixed in this session.

## Evidence checked

### 1) Current runtime blocked-leaf audit found one real offender

Command:

```bash
cd /app/projects/aks-rp-e2e.app && node - <<'JS'
const fs = require('fs');
const obj = JSON.parse(fs.readFileSync('.state/tasks/tree.json','utf8'));
const miss=[];
let blocked=0;
for (const [tid,t] of Object.entries(obj.tasks)) {
  if (t.state==='blocked') {
    blocked++;
    const blocker=t.blocker;
    const wf = blocker && blocker.waiting_for;
    const missing = blocker==null || wf==null || wf==='' || (Array.isArray(wf)&&wf.length===0) || (typeof wf==='object' && !Array.isArray(wf) && Object.keys(wf).length===0);
    if (missing) miss.push({tid, parent_id:t.parent_id, kind:t.kind, owner:t.owner, blocker});
  }
}
console.log(JSON.stringify({blocked, missingCount: miss.length, miss}, null, 2));
JS
```

Observed result:

```json
{
  "blocked": 89,
  "missingCount": 1,
  "miss": [
    {
      "tid": "apply-compact-package-partial-current-head-durable-writeback-owner-apply",
      "parent_id": "aks-feature-compact-loop",
      "kind": "domain_leaf",
      "owner": "aks-explorer",
      "blocker": {
        "condition": "Do not mark this task accepted as completed; its core acceptance criteria require actual durable/controller-visible mutation, which the worker explicitly did not perform.",
        "category": "external-wait",
        "owner": "external",
        "resume_condition": "Create a bounded metadata-repair task that explicitly names the permitted commands, exact task ids, and compact-state feature bindings to mutate for this sampled20 slice."
      }
    }
  ]
}
```

### 2) Live metric sample agreed the breach was still open before repair

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-waiting-for-count --json
```

Observed result before repair:

```json
{ "measuredAt": 1783421091758, "value": 1 }
```

### 3) Supported repair command repaired the exact blocked holder

Dry-run first showed the same target:

```json
{
  "dryRun": true,
  "repairedCount": 1,
  "repaired": [
    "apply-compact-package-partial-current-head-durable-writeback-owner-apply"
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
  "repairedCount": 1,
  "unchangedCount": 88,
  "repaired": [
    "apply-compact-package-partial-current-head-durable-writeback-owner-apply"
  ]
}
```

### 4) The repaired runtime task now has structured `waiting_for`

Direct read of the repaired task in `.state/tasks/tree.json`:

```json
{
  "condition": "Do not mark this task accepted as completed; its core acceptance criteria require actual durable/controller-visible mutation, which the worker explicitly did not perform.",
  "category": "external-wait",
  "owner": "external",
  "resume_condition": "Create a bounded metadata-repair task that explicitly names the permitted commands, exact task ids, and compact-state feature bindings to mutate for this sampled20 slice.",
  "blocked_at": "2026-07-07T10:41:49.141Z",
  "waiting_for": {
    "type": "blocker.resolved",
    "taskId": "apply-compact-package-partial-current-head-durable-writeback-owner-apply"
  },
  "observed_by": {
    "workflow": "project-planner",
    "schedule": "blocked-frontier-owner-review",
    "trigger": "project.planning.requested"
  },
  "observation_method": "Scheduled blocked-frontier owner review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
  "next_check_at": "2026-07-07T10:55:07.112Z",
  "fallback_at": "2026-07-08T10:45:07.112Z",
  "fallback_action": "If the wait is still true at fallback time, create or reuse an owner recovery/escalation task, or update the blocked wait with fresh evidence."
}
```

### 5) Fresh direct audit of the runtime tree is now clean

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun -e 'import { taskTreeConfig } from "./workflows/lib/task-tree-tools.ts"; import { readTaskTree } from "./workflows/lib/task-tree-store.ts"; import { join, resolve } from "node:path"; const effectiveAppDir=resolve(process.cwd()); const projectDir=resolve(join(effectiveAppDir,"..","aks-rp-e2e")); const tree=readTaskTree(taskTreeConfig({appDir:effectiveAppDir, projectDir, worker:"aks-explorer", maxConcurrent:1})); const miss=[]; let blocked=0; for (const [tid,t] of Object.entries(tree.tasks??{})) { const state=t.state??t.status; if (state==="blocked" && ((t.children??[]).length===0)) { blocked++; const b=t.blocker&&typeof t.blocker==="object"&&!Array.isArray(t.blocker)?t.blocker:null; const wf=b&&(b.waiting_for??b.waitingFor); const missing=!wf || (typeof wf==="object" && !Array.isArray(wf) && Object.keys(wf).length===0); if (missing) miss.push(tid);} } console.log(JSON.stringify({updated_at:tree.updated_at, active_task_id:tree.active_task_id, blocked, missing:miss},null,2));'
```

Observed result:

```json
{
  "updated_at": "2026-07-07T10:45:50.181Z",
  "active_task_id": "review-spec-private-cluster-terminal-runs-28671841561-28840446579-fronti",
  "blocked": 89,
  "missing": []
}
```

### 6) Immediate metric recompute still reports `1`

Command run immediately after repair:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-waiting-for-count --json
```

Observed result:

```json
{ "measuredAt": 1783421107875, "value": 1 }
```

That discrepancy means recovery should be validated by the next scheduled metric snapshot / alert refresh, not by assuming the alert row is already closed.

## Conclusion

Choose `fix_root_cause`: the alert corresponded to a real blocked task missing `blocker.waiting_for`, the supported owner repair command repaired that task safely, and the runtime task-tree audit is now clean even though alert recovery still depends on the next metrics refresh.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-waiting-for-count`.
