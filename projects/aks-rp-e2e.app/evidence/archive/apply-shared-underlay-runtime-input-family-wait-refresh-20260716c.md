# Apply proposal — shared underlay/runtime-input family wait refresh — 2026-07-16c

- Task: `ops/apply-shared-underlay-runtime-input-family-wait-refresh-20260716c`
- Attempt: `a_ops_apply-shared-underlay-runtime-input-family-wait-refresh-20260716c_20260716154916`
- Mode: Task Worker Mode / evidence + exact planner proposal only
- Runtime task-tree mutation from this worker: none
- Refresh source memo: `evidence/archive/reconcile-shared-underlay-runtime-input-family-return-20260716c.md`

## Executive result

I did **not** mutate the live task tree from this worker session because the
assigned task does not explicitly authorize an exact state-changing `task-tree`
command. I re-read the live wait, the app-owned loop projections, the approval
ledger, and the runtime DB.

Current judgment:

1. `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708` is
   still the correct single shared wait;
2. its live blocker still preserves the exact 2026-07-08 / 2026-07-10 lineage,
   but it has **not yet** been refreshed with the 2026-07-16 reconciliation;
3. no controller-visible `project.approval.submitted` return exists yet;
4. no stronger accepted same-lineage runtime-input proof exists yet;
5. dependent holders still point at shared-family representations rather than
   feature-local rerun work; and
6. the next truthful planner move is one in-place wait refresh only: append the
   reconciliation memo as evidence source, keep the stored 2026-07-08 /
   2026-07-10 approval lineage unchanged, and advance the watch window to
   `2026-07-17T15:30:00Z` / `2026-07-18T15:30:00Z`.

## Primary-source evidence

### 1) Live wait still shows the pre-apply state

`bun run task-tree show wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
currently shows:

- outputs do **not** include
  `evidence/archive/reconcile-shared-underlay-runtime-input-family-return-20260716c.md`
- blocker condition still says `Rechecked live controller-visible state on 2026-07-15`
- `blocker.next_check_at = 2026-07-16T15:30:00Z`
- `blocker.resume_at = 2026-07-16T15:30:00Z`
- `blocker.fallback_at = 2026-07-17T15:30:00Z`
- preserved stored lineage remains:
  - `pathId = shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
  - `pathId = shared-owner-return-family-refresh-20260710`
  - `approvalId = aks-rp-e2e:approval:shared-owner-return-family-refresh-20260710:evidence-archive-ops-recover-overdue-owner-return-family-20260710.md`
  - `waitId = wait:aks-rp-e2e:approval:shared-owner-return-family-refresh-20260710:evidence-archive-ops-recover-overdue-owner-return-family-20260710.md`

So the live wait is still on the earlier 2026-07-15 wording/window and has not
absorbed the accepted 2026-07-16 reconciliation yet.

### 2) Runtime DB still shows no returned approval submission

Runtime DB checks:

- `PRAGMA table_info(events)` confirms the approval event payload lives in
  `events.data` and the event time lives in `events.timestamp`
- `SELECT event_type, COUNT(*) ... WHERE event_type LIKE 'project.approval.%'`
  currently returns only:
  - `project.approval.requested = 5`
- `SELECT ... FROM events WHERE event_type = 'project.approval.submitted'`
  returns zero rows

So there is still **no controller-visible approval return** for the preserved
shared-underlay wait lineage.

### 3) Send-proof lineage remains the same 2026-07-08 / 2026-07-10 pair

`.state/approval-dispatch-runs.jsonl` still shows the same shared-underlay send
proof that the live wait stores today:

- line `69`: `2026-07-08T14:27:13.334Z`, `result=message.created`,
  `pathId=shared-underlay-runtime-input-family-upgrade-inclusive-20260708`,
  `packetPath=evidence/archive/ops-escalate-shared-underlay-runtime-input-family-return-20260708.md`
- line `86`: `2026-07-10T15:34:28.376Z`, `result=message.created`,
  `pathId=shared-owner-return-family-refresh-20260710`,
  `packetPath=evidence/archive/ops-recover-overdue-owner-return-family-20260710.md`,
  with the exact stored `approvalId`/`waitId`
- line `87`: same refresh packet was `duplicate-suppressed`

The live wait already preserves the exact approvalId/waitId from line `86`. The
2026-07-16 refresh should keep that stored lineage unchanged and should not open
another underlay/runtime-input ask.

### 4) Dependent compact/spec holders are still represented by shared-family paths

#### Cost-analysis still projects to the shared underlay family

`bun run task-tree show hold-compact-cost-analysis-reviewed-exception-frontier`
shows:

- `context.frontierTaskIds = ["wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708"]`
- `context.compactFrontierTaskIds = ["wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708"]`
- blocker text explicitly says to keep one shared family reconciliation path
  rather than a cost-analysis-only environment umbrella or unchanged rerun

#### Trusted-access remains on its own shared-family wait, not a feature-local umbrella

`bun run task-tree show wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711`
shows trusted-access still carried by one separate shared runtime-family wait,
with:

- `blocker.next_check_at = 2026-07-16T18:45:00Z`
- `blocker.resume_at = 2026-07-16T18:45:00Z`
- `blocker.fallback_at = 2026-07-17T18:45:00Z`

This preserves shared-family representation instead of reopening trusted-access
as feature-local rerun work.

#### Prior serverless overblock cleanup remains representation cleanup

Current `.state/feature-compact-loop/state.json` for `serverless` says:

- `ownerReason`: the app-owned serverless holder must point at
  `domain/repair-serverless-compact-readiness-vs-model-20260715` rather than
  the unrelated schedulerctrl underlay family
- `resumeCondition`: do not restore
  `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708` as the
  active representation unless accepted evidence proves the compact frontier
  truly collapses back to that family

So the prior overblock cleanup is still represented as sharper state cleanup,
not as a feature-local rerun request.

## Exact planner-owned apply proposal

Because this worker pass is read-only, the exact next step is a planner-owned
in-place wait refresh on the existing task id.

### Canonical mutation payload

```json
{
  "taskId": "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
  "outputs": [
    "../aks-rp-e2e/evidence/archive/ops-refresh-shared-underlay-upgrade-inclusive-owner-handoff-20260708.md",
    "evidence/archive/ops-apply-execute-shared-underlay-runtime-input-family-review-wave-app-ops-20260712.md",
    "evidence/archive/ops-apply-repair-orphaned-future-review-lineage-pointers-20260713-state-repair.md",
    "evidence/archive/ops-apply-repair-shared-underlay-runtime-input-family-recovery-lineage-2-20260712-state-repair.md",
    "evidence/archive/ops-repair-overdue-shared-underlay-runtime-input-family-frontier-20260713.md",
    "evidence/archive/reconcile-shared-underlay-runtime-input-family-return-20260716c.md"
  ],
  "blocker": {
    "condition": "Rechecked live controller-visible state on 2026-07-16: runtime DB still has no project.approval.submitted return for the preserved 2026-07-08 / 2026-07-10 shared underlay lineage, and no stronger accepted same-lineage runtime-input proof has appeared. Current spec-loop and compact-facing projections still bind unchanged carriers to this exact family wait, so keep the same governed underlay/runtime-input family wait in place and advance only its review window.",
    "category": "external-wait",
    "owner": "human",
    "blocked_at": "2026-07-08T07:06:30.800Z",
    "waiting_for": {
      "type": "project.approval.submitted",
      "approvalKind": "approval-packet-dispatch",
      "taskId": "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
      "pathId": "shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
      "packetPaths": [
        "evidence/archive/ops-escalate-shared-underlay-runtime-input-family-return-20260708.md",
        "evidence/archive/ops-recover-overdue-owner-return-family-20260710.md"
      ],
      "lineages": [
        {
          "pathId": "shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
          "packetPath": "evidence/archive/ops-escalate-shared-underlay-runtime-input-family-return-20260708.md",
          "messageCreatedAt": "2026-07-08T14:27:13.334Z"
        },
        {
          "pathId": "shared-owner-return-family-refresh-20260710",
          "approvalId": "aks-rp-e2e:approval:shared-owner-return-family-refresh-20260710:evidence-archive-ops-recover-overdue-owner-return-family-20260710.md",
          "waitId": "wait:aks-rp-e2e:approval:shared-owner-return-family-refresh-20260710:evidence-archive-ops-recover-overdue-owner-return-family-20260710.md",
          "packetPath": "evidence/archive/ops-recover-overdue-owner-return-family-20260710.md"
        }
      ],
      "approvalIds": [
        "aks-rp-e2e:approval:shared-owner-return-family-refresh-20260710:evidence-archive-ops-recover-overdue-owner-return-family-20260710.md"
      ],
      "waitIds": [
        "wait:aks-rp-e2e:approval:shared-owner-return-family-refresh-20260710:evidence-archive-ops-recover-overdue-owner-return-family-20260710.md"
      ],
      "projectPath": "projects/aks-rp-e2e.app",
      "acceptedDecisions": [
        "approve",
        "adjust",
        "hold",
        "decline",
        "reroute"
      ]
    },
    "observed_by": {
      "workflow": "project-planner",
      "trigger": "project.approval.submitted"
    },
    "observation_method": "Planner/app-ops should reconcile this shared underlay/runtime-input family wait when a matching returned project.approval.submitted decision arrives for the exact 2026-07-08 family lineage or the accepted 2026-07-10 shared owner-return refresh lineage; blocked-frontier review should only refresh the same lineage if no decision, decline, or reroute arrives by the stated window.",
    "next_check_at": "2026-07-17T15:30:00Z",
    "resume_condition": "Resume only when project.approval.submitted returns a bounded decision for this exact shared underlay/runtime-input family lineage, when reviewed same-lineage evidence supplies AKS_RP_E2E_UNDERLAY_KUBECONFIG(_B64), AKS_RP_E2E_CONTROL_PLANE_ID, AKS_RP_E2E_ASSIGN_IDENTITY, and/or AKS_RP_E2E_OVERLAY_RECONCILE_HEADERS as needed by the unchanged governed carriers, or when an exact decline or authoritative reroute materially changes this same family.",
    "resume_at": "2026-07-17T15:30:00Z",
    "fallback_at": "2026-07-18T15:30:00Z",
    "fallback_action": "If no returned same-lineage signal arrives by fallback, refresh this exact shared underlay/runtime-input family wait against the same 2026-07-08 / 2026-07-10 send-proof lineage, preserve dependent compact/spec holders as shared-family representations, and do not create duplicate owner asks or reopen unchanged reruns."
  },
  "result": "Blocked-frontier review confirmed the shared underlay/runtime-input family wait still governs the same carriers with the same preserved 2026-07-08 / 2026-07-10 send proof, so the 2026-07-16 reconciliation should be recorded in place and the review window moved forward.",
  "refresh_source": "evidence/archive/reconcile-shared-underlay-runtime-input-family-return-20260716c.md"
}
```

### Planner guardrails

- Keep the existing task id:
  `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
- Keep the stored `approvalId` / `waitId` / `packetPaths` unchanged
- Do **not** create a new `project.approval.requested` lineage for this same
  shared underlay/runtime-input family
- Do **not** reopen feature-local reruns for cost-analysis or trusted-access
- Do **not** restore the old serverless underlay overblock

## Acceptance readout

### Dependent shared-family holders preserved?

Yes. Cost-analysis still points to the shared underlay wait, trusted-access
still points to its own shared runtime-family wait, and serverless still stays on
representation cleanup rather than a broad rerun.

### Reconciliation memo included or cited?

The live wait does not yet include it, but this apply evidence explicitly cites
`evidence/archive/reconcile-shared-underlay-runtime-input-family-return-20260716c.md`
as the refresh source.

### Duplicate owner ask avoided?

Yes, in proposal form. The recommended apply preserves the existing stored
2026-07-10 approvalId/waitId lineage and adds no new approval request.

### Existing 2026-07-08 / 2026-07-10 lineage preserved?

Yes. The proposal keeps the current stored `pathId`, `approvalId`, `waitId`,
`packetPaths`, and `lineages` unchanged, while adding only the 2026-07-16
reconciliation wording and future window.

### Future watch window advanced?

Yes, in proposal form:

- `next_check_at = 2026-07-17T15:30:00Z`
- `resume_at = 2026-07-17T15:30:00Z`
- `fallback_at = 2026-07-18T15:30:00Z`

## Bottom line

The live wait is still the right single shared-family steward, but it has not
absorbed the accepted 2026-07-16 reconciliation yet. The correct next step is a
planner-owned in-place metadata refresh on the existing wait id using the exact
payload above, with no new owner ask and no feature-local rerun churn.
