# Repair compact egress-lockdown state pointer drift — 2026-07-15

- Task: `ops/repair-compact-egress-lockdown-state-pointer-drift-20260715`
- Attempt: `a_ops_repair-compact-egress-lockdown-state-pointer-drift-20260715_20260715075240`
- Worker: `app-ops`
- Scope: app-owned compact loop state only (`/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json`)

## Result

Repaired the `egress-lockdown` compact-loop state row so it no longer points at missing task id `ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711`.

The truthful current shape is:

- the **single live frontier holder** for compact `egress-lockdown` is `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`
- there is **no current live task-tree holder specifically governing** `spec.egress-lockdown.vm-prerelease-vhd-matrix`
- the accepted shared-auth owner-return lineage is preserved only as lineage metadata on path id `shared-authenticated-artifact-result-recovery-family-20260712`

So the repair rewrote the stale pointer instead of inventing a replacement holder.

## Sources used

### Live app state
- `/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json`
- `/app/projects/aks-rp-e2e.app/tasks/tree.json`

### Accepted archived evidence
- `evidence/archive/ops-normalize-compact-egress-lockdown-exact-wait-contract-20260709.md`
- `.state/tasks/archive/done-leaves-20260709095953779.json`
- `evidence/archive/ops-reconcile-shared-auth-dependent-holder-hygiene-20260714b.md`
- `evidence/archive/ops-reconcile-shared-auth-owner-return-family-shape-20260714.md`
- `evidence/archive/ops-apply-private-cluster-shared-auth-family-rewrite-20260714.md`
- `evidence/archive/ops-apply-reconcile-compact-loop-package-partial-task-tree-followup-20260715.md`

## Before state row

Read from `.state/feature-compact-loop/state.json` before repair:

```json
{
  "featureKey": "egress-lockdown",
  "taskId": "ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711",
  "frontierTaskIds": [
    "wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702"
  ],
  "waitingFor": {
    "type": "environment.available",
    "taskId": "ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711"
  },
  "retryReason": "Resume only when a returned approval/owner response lands for pathId shared-github-dispatch-auth-capable-runtime-20260709 ...",
  "waitingCondition": "Resume only when a returned approval/owner response lands for pathId shared-github-dispatch-auth-capable-runtime-20260709 ..."
}
```

Problem:

- `ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711` is no longer in the live tree
- the state row still treated that retired id as the active holder even though the exact live frontier already remained `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`

## Live holder / no-holder finding

### 1) The old compact duplicate holder was already retired by accepted review

Accepted 2026-07-09 evidence says the duplicate compact holder was intentionally removed:

- `evidence/archive/ops-normalize-compact-egress-lockdown-exact-wait-contract-20260709.md` concluded the smallest truthful repair was to retire `hold-compact-egress-lockdown-package-partial-frontier-202607090915` and keep `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702` as the single live carrier.
- `.state/tasks/archive/done-leaves-20260709095953779.json` records the accepted review summary: compact egress-lockdown is already truthfully represented by `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`.
- `.state/tasks/archive/done-leaves-20260709112705639.json` records the retired holder itself as `resolution: replaced` with acceptance note: compact state already projects egress-lockdown through `frontierTaskIds` to the exact human-owned UDR prerequisite wait, so the package-partial holder was duplicate blocked surface with no distinct resume or retest contract.

### 2) No current live shared-auth holder specifically carries egress-lockdown

Current live `tasks/tree.json` contains:

- `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`
- `ops/wait-project-approval-owner-return-primary-blocker-20260713`
- `wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704`

Current live `tasks/tree.json` does **not** contain:

- `ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711`
- `ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711-owner-normalized`
- any live task mentioning `spec.egress-lockdown.vm-prerelease-vhd-matrix`

Accepted 2026-07-14 shared-auth audits show why:

- `evidence/archive/ops-reconcile-shared-auth-owner-return-family-shape-20260714.md` says the old shared-auth holder was normalized, then the live family shape became one governing project wait plus one dependent shared-auth holder.
- `evidence/archive/ops-reconcile-shared-auth-dependent-holder-hygiene-20260714b.md` shows the current accepted shared-auth contributor set is:
  - `wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704`
  - `hold-spec-private-cluster-shared-auth-run-pair-family-20260714`
  - `hold-spec-node-confidential-vm-snp-pool-run-28672036322-artifact-visibility-frontier-20260707c`
  - `hold-spec-secops-fips-slice1-shared-cluster-run-171755307-artifact-frontier-20260714`
  - `hold-compact-rp-cluster-lifecycle-split-frontier-20260711`
- that accepted contributor set does **not** include `egress-lockdown`

Therefore the truthful finding is: **no live holder currently exists for the vm-prerelease shared-auth lineage of compact egress-lockdown**.

## After state row

After repair, `.state/feature-compact-loop/state.json` now records:

```json
{
  "featureKey": "egress-lockdown",
  "taskId": "wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702",
  "frontierTaskIds": [
    "wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702"
  ],
  "waitingFor": {
    "type": "project.approval.submitted",
    "pathId": "shared-authenticated-artifact-result-recovery-family-20260712",
    "approvalId": "aks-rp-e2e:approval:shared-authenticated-artifact-result-recovery-family-20260712:evidence-archive-ops-escalate-shared-auth-runtime-and-github-artifact-owner-return-family-20260712.md",
    "waitId": "wait:aks-rp-e2e:approval:shared-authenticated-artifact-result-recovery-family-20260712:evidence-archive-ops-escalate-shared-auth-runtime-and-github-artifact-owner-return-family-20260712.md",
    "packetPath": "evidence/archive/ops-escalate-shared-auth-runtime-and-github-artifact-owner-return-family-20260712.md",
    "governingTaskId": "ops/wait-project-approval-owner-return-primary-blocker-20260713"
  },
  "nextCheckAt": "2026-07-15T21:45:00Z",
  "fallbackAt": "2026-07-16T21:45:00Z",
  "reviewEvidencePath": "evidence/archive/repair-compact-egress-lockdown-state-pointer-drift-20260715.md"
}
```

### What changed

1. `taskId`
   - before: missing retired shared-auth wait id
   - after: exact live frontier holder `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`

2. `waitingFor`
   - before: dangling `taskId` reference to a missing task
   - after: lineage-only metadata for the accepted shared-auth approval family, with **no invented replacement task id**

3. Review windows
   - aligned to the current live FIPS frontier cadence instead of the stale 2026-07-11 values

4. Summary / reason text
   - rewritten to say that the FIPS wait is the live holder and the vm-prerelease shared-auth branch currently has no separate live holder

## Why no duplicate rerun wait or compact follow-up was created

I intentionally did **not** create a new egress-lockdown rerun wait or compact follow-up because accepted evidence already says not to.

1. `ops-normalize-compact-egress-lockdown-exact-wait-contract-20260709.md` and its accepted archive record already retired the duplicate compact holder in favor of the exact FIPS wait.
2. `evidence/archive/ops-apply-reconcile-compact-loop-package-partial-task-tree-followup-20260715.md` explicitly preserves `egress-lockdown` in the “preserve without duplicate ready-subset leaf” set and separately flags only this state-pointer repair.
3. The live tree currently has no truthful egress-specific shared-auth holder to point at, so fabricating one here would violate the task acceptance.

So the smallest truthful repair was:

- keep the single live frontier carrier already accepted (`wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`)
- preserve the accepted shared-auth lineage as metadata only
- remove the stale missing task pointer
- create **no** duplicate rerun wait and **no** duplicate ready-subset follow-up

## Acceptance mapping

### 1) Identify the single truthful shared-auth owner-return holder, or prove none exists

Met.

Finding: no current live holder specifically governs compact `egress-lockdown` on the shared-auth owner-return lineage. The accepted lineage still exists at path `shared-authenticated-artifact-result-recovery-family-20260712`, but the current live holders for that family no longer include egress-lockdown.

### 2) Update compact-loop state only if replacement holder is live and unambiguous; otherwise remove/rewrite stale pointer while preserving frontier and wait semantics

Met.

No replacement holder existed, so I rewrote the stale pointer:

- `taskId` now points at the exact live frontier wait
- `frontierTaskIds` stayed unchanged
- vm-prerelease owner-return semantics remain preserved as lineage metadata and wait text

### 3) Record before/after state entry, chosen holder/no-holder finding, and why no duplicate wait/follow-up was created

Met in this memo.

## Bottom line

Compact `egress-lockdown` now points at the one truthful live frontier wait and no longer references the retired shared-auth task id. The vm-prerelease shared-auth approval lineage is still preserved, but only as lineage metadata because there is currently no live task-tree holder for that branch.