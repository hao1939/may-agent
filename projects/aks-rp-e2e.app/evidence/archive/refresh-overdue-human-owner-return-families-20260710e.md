# refresh-overdue-human-owner-return-families-20260710e

- Task: `ops/refresh-overdue-human-owner-return-families-20260710e`
- Attempt: `a_ops_refresh-overdue-human-owner-return-families-20260710e_20260710043947`
- Reviewed at: `2026-07-10T11:43:09Z`
- Mode: Task Worker Mode / planner-review output only unless the task explicitly names bounded task-tree commands
- Runtime tree mutation from this worker: none

## Authority and inclusion rule

Per the task and worker-mode rules, I used the **live runtime tree** as authority:

- `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`

I treated a wait as a **human-owner return family** only when the live blocker/evidence shows an already-sent approval / owner-response / escalation / routed-packet lineage, not just a generic human-owned environment wait.

## High-level result

There is **no uncovered overdue human-owner return family currently contributing to the blocked-overdue alert baseline**.

Evidence:

- runtime metrics currently show:
  - `aks-rp-e2e.process.blocked.overdue-unworked-count = 9`
  - `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count = 9`
- the companion nonhuman audit already decomposed those same nine offenders as compact-only nonhuman holders, leaving **zero** noncompact residue and no human-family contributor set.
- runtime events still show **zero** `project.approval.submitted` rows, so the live human-return waits are waiting on operator response, not missing a visible replacement wait.

So the live problem is mostly **operator nonresponse plus stale reference drift**, not missing family coverage.

## Current overdue live human-owner return families

These are the currently overdue live waits that still fit the human-return / approval-escalation shape.

| Family | Exact live wait | Why it qualifies | Overdue fields now | Exact live coverage conclusion |
|---|---|---|---|---|
| Network-ACNS Hubble contract family | `wait-spec-network-acns-hubble-contract-owner-response-20260708` | blocker cites original send-proof plus shared **third-contact** packet | `next_check_at=2026-07-10T06:00:00Z`, `resume_at=2026-07-10T06:00:00Z` | **Covered** by one exact live wait; no duplicate live sibling found |
| Shared JWT egress surface | `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708` | blocker cites accepted owner-ask send proof plus 2026-07-09 second-contact chase | `next_check_at=2026-07-10T08:45:00Z`, `resume_at=2026-07-10T07:00:00Z` | **Covered** by one exact live shared wait |
| Shared underlay/runtime-input family | `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708` | blocker cites accepted approval-dispatch/message-created lineage and awaits returned signal | `next_check_at=2026-07-10T08:45:00Z`, `resume_at=2026-07-10T07:00:00Z` | **Covered** by one exact live shared wait |
| CCP tunnelfront lineage excerpt family | `wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708` | blocker cites already-sent owner/archive packet and awaits returned excerpt or explicit no-such-excerpt decision | `next_check_at=2026-07-09T12:30:00Z` | **Covered** by one exact live wait |
| Compact node-http-proxy trusted-ca owner decision | `wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708` | blocker cites routed owner-decision packet plus 2026-07-09 second-contact chase | `next_check_at=2026-07-10T07:00:00Z`, `resume_at=2026-07-10T07:00:00Z` | **Covered** by one exact live wait; compact-facing alias correctly points at it |

## Families that looked suspicious in older notes but are **not** uncovered now

These human-return families are present in the live tree, but are **not currently overdue** after prior refreshes, so they are not part of the current overdue residue:

- `ops/wait-shared-azure-devops-auth-capable-runtime-owner-return-20260709b`
- `ops/wait-shared-github-dispatch-auth-capable-runtime-owner-return-20260710`
- `wait-kms-svc-cert-rotation-underlay-owner-decision-return-20260709`
- `ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s`
- `wait-spec-app-routing-rollback-istio-to-nginx-existing-target-return-20260708`
- `wait-spec-extension-addon-execution-identity-permission-response-20260702`
- `wait-ccp-security-patch-reviewed-exception-owner-response-20260708`
- `hold-spec-localdns-reviewed-exception-authoritative-return-family-20260706c`
- `wait-secops-identity-sp-workflow-secret-contract-return-20260704`

These already have one exact live wait each in `.state/tasks/tree.json`.

## Stale duplicate / replaced residue found

I did find stale duplicate **references** that should be treated as residue, but they are not live family waits anymore.

### 1) Old Azure DevOps auth-capable runtime wait id is stale

Stale id:

- `wait-shared-azure-devops-auth-capable-runtime-provider-response-20260709`

Live replacement:

- `ops/wait-shared-azure-devops-auth-capable-runtime-owner-return-20260709b`

Findings:

- the old id is still referenced in `tasks/tree.json`
- the old id is also still embedded in rollup/result text inside `.state/tasks/tree.json`
- there is **no live task node** for the old id in `.state/tasks/tree.json`

Meaning:

- this is stale snapshot / stale rollup text, not an uncovered live family
- planner should keep only `ops/wait-shared-azure-devops-auth-capable-runtime-owner-return-20260709b` as the exact live family wait

### 2) Old KMS underlay wait id is stale

Stale id:

- `wait-kms-svc-cert-rotation-underlay-kubeconfig-20260702`

Live replacement:

- `wait-kms-svc-cert-rotation-underlay-owner-decision-return-20260709`

Findings:

- the old id still appears in `tasks/tree.json`
- the old id still appears in the live loop/result rollup text inside `.state/tasks/tree.json`
- there is **no live task node** for the old id now

Meaning:

- this is stale rollup/snapshot residue only
- planner should keep only `wait-kms-svc-cert-rotation-underlay-owner-decision-return-20260709` as the exact live family wait

### 3) Prior schedulerctrl wait id is stale, but this is not an approval/escalation family

Stale id:

- `wait-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260707f`

Live replacement:

- `hold-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260708`

This shows the same general reference-drift pattern in snapshots/rollups, but it is not part of the human approval/escalation family set.

## Coverage conclusion per overdue family

### Covered now by exact live waits

All currently overdue human-return families identified above already have one truthful live wait in `.state`:

1. `wait-spec-network-acns-hubble-contract-owner-response-20260708`
2. `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`
3. `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
4. `wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708`
5. `wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708`

### Not covered only by review-only residue?

**No.** I did not find a currently overdue human-owner return family whose only remaining coverage is a review note, stale snapshot alias, or passive duplicate with no exact live wait.

## What the planner/app-ops apply step should do

Because this worker session was not authorized to reshape the runtime tree directly, the planner/app-ops follow-up should be metadata cleanup only:

1. treat `.state/tasks/tree.json` as authoritative for human-return family identity;
2. retire stale snapshot / rollup references to:
   - `wait-shared-azure-devops-auth-capable-runtime-provider-response-20260709`
   - `wait-kms-svc-cert-rotation-underlay-kubeconfig-20260702`
3. keep the exact live replacements:
   - `ops/wait-shared-azure-devops-auth-capable-runtime-owner-return-20260709b`
   - `wait-kms-svc-cert-rotation-underlay-owner-decision-return-20260709`
4. do **not** create a new sibling app-ops follow-up task for any currently overdue human-return family, because none is uncovered in live state;
5. if planner wants the residue removed fully, the needed change is bounded rollup/result text refresh in the live tree and export snapshot, not new family branches.

## Bottom line

Using the live `.state` tree as authority, the overdue human-owner approval/escalation backlog is **already represented by exact live waits**. The remaining residue is **stale duplicate reference drift** in rollup/snapshot surfaces, not missing live coverage.

So the correct planner action is:

- **keep the current exact live waits**,
- **retire the stale replaced ids from rollups/snapshots**, and
- **do not add a new active app-ops family task**, because there is no uncovered overdue human-return family left to represent.
