# Reconcile shared underlay/runtime-input family return — 2026-07-16c

- Task: `ops/reconcile-shared-underlay-runtime-input-family-return-20260716c`
- Attempt: `a_ops_reconcile-shared-underlay-runtime-input-family-return-20260716c_20260716154017`
- Mode: Task Worker Mode / evidence + exact planner proposal only
- Runtime task-tree mutation from this worker: none

## Result

I rechecked the exact live lineage named on `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708` and found **no controller-visible return** and **no stronger accepted same-lineage runtime-input proof** yet.

Current truthful state:

1. keep the same shared family wait `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`;
2. keep its preserved 2026-07-08 + 2026-07-10 send-proof lineage unchanged;
3. do **not** open a duplicate owner ask;
4. refresh only the wait's review window; and
5. keep dependent holders represented by the one shared family path (or, where a feature was previously overblocked, by the already-repaired sharper shared-family/non-underlay carrier rather than feature-local rerun work).

## Sources checked

### Live app-owned state

- `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`
- `/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json`
- `/app/projects/aks-rp-e2e.app/.state/spec-loop/state.json`
- `/app/projects/aks-rp-e2e.app/.state/approval-dispatch-runs.jsonl`

### Runtime DB

- `events` table schema
- `SELECT event_type, COUNT(*) ... WHERE event_type LIKE 'project.approval.%'`
- `SELECT COUNT(*) ... WHERE event_type='project.approval.submitted'`

### Same-lineage evidence anchors re-read

- `/app/projects/aks-rp-e2e/evidence/archive/ops-escalate-shared-underlay-runtime-input-family-return-20260708.md`
- `/app/projects/aks-rp-e2e/evidence/archive/ops-recover-overdue-owner-return-family-20260710.md`
- `/app/projects/aks-rp-e2e.app/evidence/archive/ops-followup-shared-underlay-runtime-input-family-return-20260710.md`
- `/app/projects/aks-rp-e2e.app/evidence/archive/ops-review-shared-underlay-runtime-input-family-lineage-20260713c.md`
- `/app/projects/aks-rp-e2e.app/evidence/archive/ops-repair-ado-467665-underlay-kubeconfig-contract-network-cni-cilium-enterprise-addon-vm-prerelease-20260715.md`

## Exact wait / approval / path lineage readback

From the live `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708` task entry in `.state/tasks/tree.json`:

- `waiting_for.type = project.approval.submitted`
- primary family `pathId = shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
- preserved refresh lineage `pathId = shared-owner-return-family-refresh-20260710`
- preserved refresh `approvalId = aks-rp-e2e:approval:shared-owner-return-family-refresh-20260710:evidence-archive-ops-recover-overdue-owner-return-family-20260710.md`
- preserved refresh `waitId = wait:aks-rp-e2e:approval:shared-owner-return-family-refresh-20260710:evidence-archive-ops-recover-overdue-owner-return-family-20260710.md`
- current watch window:
  - `resume_at = 2026-07-16T15:30:00Z`
  - `next_check_at = 2026-07-16T15:30:00Z`
  - `fallback_at = 2026-07-17T15:30:00Z`

The live wait still governs the same shared carrier family named in its goal and blocker text:

- `spec.network-cni.cilium-enterprise-addon-lifecycle`
- `spec.network-cni.cilium-enterprise-addon-vm-prerelease`
- `spec.gpu.vm-prerelease-provisioner-matrix`
- `spec.ccp-underlay-vpa.component-lifecycle`
- `spec.cost-analysis.vm-prerelease-source-seed`
- repaired serverless-schedulerctrl witnesses
- `spec.upgrade.vm-prerelease-deprecated-api-detection`

## Send-proof verification for the exact lineage

From `.state/approval-dispatch-runs.jsonl`:

- line `69`
  - `2026-07-08T14:27:13.334Z`
  - `workflow=approval-dispatch`
  - `result=message.created`
  - `packetPath=evidence/archive/ops-escalate-shared-underlay-runtime-input-family-return-20260708.md`
  - `pathId=shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
- line `86`
  - `2026-07-10T15:34:28.376Z`
  - `workflow=approval-dispatch`
  - `result=message.created`
  - `packetPath=evidence/archive/ops-recover-overdue-owner-return-family-20260710.md`
  - `pathId=shared-owner-return-family-refresh-20260710`
- line `87`
  - `2026-07-10T15:34:42.558Z`
  - same refresh packet was `duplicate-suppressed`

So the family already has current durable send proof on the exact preserved lineage. A fresh owner ask is not justified.

## Return check: no approval submission yet

Runtime DB currently shows only request-side approval events:

- `project.approval.requested = 5`
- `project.approval.submitted = 0`

Therefore I found **no controller-visible `project.approval.submitted` return** for:

- `shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
- `shared-owner-return-family-refresh-20260710`
- `aks-rp-e2e:approval:shared-owner-return-family-refresh-20260710:evidence-archive-ops-recover-overdue-owner-return-family-20260710.md`
- `wait:aks-rp-e2e:approval:shared-owner-return-family-refresh-20260710:evidence-archive-ops-recover-overdue-owner-return-family-20260710.md`

## Stronger same-lineage runtime-input evidence check

I also found **no accepted stronger same-lineage runtime-input proof** in controller-visible state.

Evidence for that judgment:

1. The live shared wait is still `blocked` on the same approval-return contract.
2. `.state/spec-loop/state.json` still keeps these governed specs bound to the same shared family wait or its same-family successor disposition:
   - `spec.ccp-underlay-vpa.component-lifecycle`
   - `spec.cost-analysis.vm-prerelease-source-seed`
   - `spec.gpu.skip-driver-install`
   - `spec.gpu.vm-prerelease-provisioner-matrix`
   - `spec.network-cni.cilium-enterprise-addon-lifecycle`
   - `spec.network-cni.cilium-enterprise-addon-vm-prerelease`
   - `spec.upgrade.vm-prerelease-deprecated-api-detection`
3. The latest direct underlay carrier review I re-read (`ops-repair-ado-467665-underlay-kubeconfig-contract-network-cni-cilium-enterprise-addon-vm-prerelease-20260715.md`) still concludes there is **no reviewed proof** that the ADO carrier now supplies `AKS_RP_E2E_UNDERLAY_KUBECONFIG(_B64)` and **no reviewed explicit decline** either.

So nothing in accepted live state justifies replacing the wait with a returned decision, reopening unchanged reruns, or splitting the family into duplicate asks.

## Dependent holder representation check

### Shared-underlay family dependents still represented by one shared path

Current app-owned state still shows the shared underlay family carried as one shared path rather than feature-local duplicate blockers:

- compact feature `cost-analysis`
  - `taskId = hold-compact-cost-analysis-reviewed-exception-frontier`
  - `frontierTaskIds = ["wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708"]`
  - `waitingFor.taskId = wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
- spec-loop carriers remain on the same family wait / successor disposition set listed above

### Prior overblock cleanup remains representation cleanup, not rerun work

Two adjacent checks matter here:

1. `serverless` compact is **not** still incorrectly carried by the underlay family. Current compact state now points it at `domain/repair-serverless-compact-readiness-vs-model-20260715`, which is the sharper repo-local compact-truth repair. That means the old false extra dependency on this underlay family has already been removed rather than silently preserved.
2. `trusted-access` compact is still represented by **one shared family path** of its own (`wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711`), not by a feature-local environment umbrella. This confirms the related environment-overblock cleanup remains shared-family representation cleanup rather than duplicate per-feature rerun work.

## Exact planner/app-ops wait-refresh proposal

Because this worker attempt is not authorized to mutate the live task tree, the exact next step is a **canonical wait update proposal**, not an emitted event.

### Keep unchanged

- wait id: `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
- conflict scope: `ops:shared-underlay-runtime-input-family`
- waiting-for lineage:
  - `shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
  - `shared-owner-return-family-refresh-20260710`
  - existing `approvalId` / `waitId`
- governed carrier set
- no new `project.approval.requested`

### Refresh only the watch window and evidence text

Recommended bounded update:

```json
{
  "taskId": "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
  "outputs_append": [
    "evidence/archive/reconcile-shared-underlay-runtime-input-family-return-20260716c.md"
  ],
  "blocker": {
    "condition": "2026-07-16 reconciliation rechecked the exact 2026-07-08 / 2026-07-10 shared underlay/runtime-input approval lineage and found no project.approval.submitted return plus no stronger accepted same-lineage runtime-input proof. Durable send proof remains the 2026-07-08T14:27:13.334Z message.created packet on pathId shared-underlay-runtime-input-family-upgrade-inclusive-20260708 and the 2026-07-10T15:34:28.376Z refresh packet on pathId shared-owner-return-family-refresh-20260710, so keep this one shared family wait and advance only its review window.",
    "next_check_at": "2026-07-17T15:30:00Z",
    "resume_at": "2026-07-17T15:30:00Z",
    "fallback_at": "2026-07-18T15:30:00Z",
    "fallback_action": "If no returned same-lineage signal arrives by fallback, refresh this exact shared underlay/runtime-input family wait against the same 2026-07-08 / 2026-07-10 send-proof lineage, preserve dependent compact/spec holders as shared-family representations, and do not create duplicate owner asks or reopen unchanged reruns."
  }
}
```

## Reviewer-facing acceptance check

### 1) Exact lineage checked?

Yes. I checked the live wait's stored `pathId`, `approvalId`, `waitId`, packet paths, and the approval-dispatch ledger rows for the 2026-07-08 and 2026-07-10 lineage.

### 2) If no return exists, exact shared wait refreshed or exact refresh proposed?

No return exists. In worker mode I cannot emit the task-tree change, so I recorded the exact canonical wait-refresh proposal above, including:

- same send-proof lineage
- no duplicate owner ask
- explicit new watch window

### 3) Dependent holders kept on one shared family path?

Yes. `cost-analysis` still points to `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`, and adjacent overblock cleanup remains shared-family representation cleanup (`serverless` sharpened away from the underlay family; `trusted-access` remains on its own shared family wait instead of a feature-local blocker).

## Bottom line

The exact shared underlay/runtime-input lineage is still unanswered. The right move is **not** a new ask and **not** a feature-local rerun. It is one bounded refresh of `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708` to carry this reconciliation evidence and move its review window forward while preserving the same 2026-07-08 / 2026-07-10 lineage and the same shared-family dependent-holder shape.
