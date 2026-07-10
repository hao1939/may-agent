# Repair review — overdue human-owned blocked frontier family — 2026-07-09

- Task: `ops/repair-overdue-human-blocked-frontier-family-20260709h`
- Attempt: `a_ops_repair-overdue-human-blocked-frontier-family-20260709h_20260709195750`
- Mode: Task Worker Mode / planner-review evidence only / no task-tree mutation from this session
- Reviewed at: `2026-07-09T11:43:09Z`

## Result

The best current overdue human-owned family repair is the **extension-addon execution-identity permission-response family** spanning one exact spec wait and its compact represented holder:

- `wait-spec-extension-addon-execution-identity-permission-response-20260702`
- `hold-compact-extension-addon-reviewed-exception-frontier`

This family is the clearest remaining **passive human wait with stale watch metadata and no current active owner-action task**. Unlike the shared-underlay and shared-jwt families, which already have refreshed family-level waits and newer chase/coverage evidence, the extension-addon family still relies on the original 2026-07-02 send-proof packet and an overdue `next_check_at` with no controller-visible fresh chase/escalation coverage.

So the best family-level recovery is:

1. preserve the existing exact spec wait,
2. preserve the compact holder only as a represented split-frontier carrier,
3. **add one exact successor escalation/handoff task** on the same lineage instead of reopening reruns or creating duplicate waits.

## Why this is the best current overdue human-owned family

### Baseline rule

Per worker instructions, compute the baseline as if this audit task did not exist.

### Pre-audit contributor facts

Current task-tree facts show the spec wait is still a blocked human-owned wait with stale watch timing:

- `wait-spec-extension-addon-execution-identity-permission-response-20260702`
  - `blocker.owner = human`
  - `next_check_at = 2026-07-09T09:45:00Z`
  - `fallback_at = 2026-07-10T09:45:00Z`
  - goal: keep one exact family-level response wait for `spec.extension-addon.enable-upgrade-disable`

The compact frontier still points at that same spec wait rather than a different exact blocker:

- `hold-compact-extension-addon-reviewed-exception-frontier`
  - blocker text explicitly says it is **represented by** `wait-spec-extension-addon-execution-identity-permission-response-20260702`
  - only affected compact member: `spec.extension-addon.enable-upgrade-disable`

I also checked current active/review tasks in the live task tree and found **no active or review task** naming `extension-addon`, `wait-spec-extension-addon-execution-identity-permission-response-20260702`, or `feature:extension-addon`.

So, if this audit task is self-excluded, this family remains a truthful overdue human-owned contributor with:

- one overdue spec wait,
- one compact represented holder depending on it,
- no fresh active owner-action surface.

### Why this family is a better target than other human-owned waits

Other recent overdue human-owned families already show fresher exact coverage or chase action:

- shared underlay/runtime-input family already narrowed to `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708` with refreshed future watch windows;
- shared jwt-authenticator family already has refreshed watch metadata and newer second-contact chase evidence from 2026-07-09;
- network-acns / ccp-security-patch owner-response waits already have a documented combined third-contact chase packet on 2026-07-09.

By contrast, extension-addon still shows:

- original send-proof packet from `2026-07-02`,
- overdue `next_check_at`,
- no newer chase/escalation evidence in the active tree,
- no other active/review coverage task.

That makes extension-addon the smallest exact family where one missing owner-action successor would materially improve blocked-frontier shape.

## Exact family state

### 1) Spec wait

`wait-spec-extension-addon-execution-identity-permission-response-20260702`

Current meaning preserved in the tree:

- exact path: `spec.extension-addon.enable-upgrade-disable`
- exact blocked surface: `managedClusters/.../extensionaddons/fake`
- exact ask: permission proof or reviewed response for the staging workflow execution identity
- current wait state: blocked / owner `human`
- current stale watch window:
  - `next_check_at = 2026-07-09T09:45:00Z`
  - `fallback_at = 2026-07-10T09:45:00Z`

### 2) Compact represented holder

`hold-compact-extension-addon-reviewed-exception-frontier`

Current meaning preserved in the tree:

- compact feature: `extension-addon`
- exact represented blocker: `wait-spec-extension-addon-execution-identity-permission-response-20260702`
- exact governed member: `spec.extension-addon.enable-upgrade-disable`
- no separate compact rerun or environment setup task is truthful while the spec wait remains unchanged

So this is already one exact spec+compact family. The missing piece is not decomposition. The missing piece is **fresh owner action**.

## Existing send-proof that should be preserved

The family already has durable first-contact proof in:

- `evidence/archive/send-extension-addon-execution-identity-permission-ask-20260702.md`

That evidence records:

- exact witness run: `28609113218`
- exact blocked PUT surface: `managedClusters/.../extensionaddons/fake`
- exact staging workflow execution identity app ID: `b747b4cd-f6af-44a9-b621-24e192264fce`
- approval-dispatch ledger row with `result: message.created`
- human/operator routing proof

So this family does **not** need a new initial ask. It needs a **successor chase/escalation task** on the same exact lineage because the first ask is already proven sent.

## Family-level judgment

### Decision

Create **one missing escalation/handoff task** for the extension-addon family.

Do **not**:

- reopen unchanged extension-addon reruns,
- create duplicate spec and compact waits,
- replace the current exact wait with a broader family bucket.

### Why this is truthful

The current frontier is still the same human-owned permission-response boundary. The only process gap is that the wait has gone overdue without a newer active owner-action surface.

That means the truthful repair is one bounded owner chase/escalation successor that:

- cites the already-sent 2026-07-02 packet,
- asks for one reviewed returned outcome on the same PUT surface,
- refreshes the app-visible owner-action lineage,
- leaves the spec wait and compact represented holder intact unless a returned response changes them.

## Exact planner/app-ops follow-up to add

Suggested successor task goal:

> Chase or escalate the overdue extension-addon execution-identity permission-response family by routing one exact follow-up packet on the existing 2026-07-02 send-proof lineage for `spec.extension-addon.enable-upgrade-disable`, then preserve the current spec wait and compact represented holder unless the returned response materially changes the boundary.

### Exact affected task ids

- `wait-spec-extension-addon-execution-identity-permission-response-20260702`
- `hold-compact-extension-addon-reviewed-exception-frontier`

### Exact evidence lineage to preserve

- `evidence/archive/send-extension-addon-execution-identity-permission-ask-20260702.md`
- `evidence/archive/rehome-compact-extension-addon-exact-package-frontier-20260707.md`
- `evidence/archive/ops-repair-compact-environment-overblock-family-batch4-20260709t.md`

### Exact resume condition for the successor action

Resume/complete the follow-up when one of these becomes controller-visible for the same extension-addon PUT surface:

1. proof that the same execution identity can now perform the exact `extensionaddons/fake` PUT;
2. the exact required role/action or owner redirect for that surface;
3. one approved alternate execution environment/identity for the unchanged spec path; or
4. an exact decline that materially changes the rerun/closure decision.

If no returned outcome exists yet, the task should produce fresh send-proof/chase-proof and leave the current exact wait in place with refreshed review timing.

## Pre-audit contributor set vs post-action represented set

### Pre-audit contributor set

- `wait-spec-extension-addon-execution-identity-permission-response-20260702`
- compact family dependency carried by `hold-compact-extension-addon-reviewed-exception-frontier`

### Post-action represented set if planner applies the successor

- same exact spec wait remains the canonical blocker:
  - `wait-spec-extension-addon-execution-identity-permission-response-20260702`
- same exact compact represented holder remains the compact-facing projection:
  - `hold-compact-extension-addon-reviewed-exception-frontier`
- one new active owner-action surface exists on the same lineage:
  - successor chase/escalation task to refresh send-proof or collect returned outcome

That is a better shape because the family would no longer sit on a passive overdue human wait with only stale first-contact evidence.

## What should not happen

- Do not split this into separate spec and compact owner waits.
- Do not reopen an unchanged extension-addon live rerun.
- Do not replace the exact permission-response wait with a broader compact-environment or generic auth family.
- Do not treat the compact holder as independently actionable while it is explicitly represented by the spec wait.

## Bottom line

The best current overdue human-owned blocked-frontier family repair is **extension-addon execution-identity permission response**.

It already has exact family structure and original send proof, but it is missing a fresh active chase/escalation surface while the spec wait is overdue and the compact holder still depends on it. The planner should therefore add **one exact successor escalation/handoff task** for:

- `wait-spec-extension-addon-execution-identity-permission-response-20260702`
- `hold-compact-extension-addon-reviewed-exception-frontier`

and keep the existing exact wait/holder pair unchanged unless the returned owner response materially changes the boundary.
