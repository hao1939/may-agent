# Compact-loop blocked frontier family audit — 2026-07-11

- Task: `ops/reduce-compact-loop-blocked-frontier-family-20260711`
- Attempt: `a_ops_reduce-compact-loop-blocked-frontier-family-20260711_20260711135038`
- Mode: Task Worker Mode / audit + planner-review evidence only
- Runtime task-tree mutation from this worker: none
- Reviewed against: `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`

## Scope and baseline

Per task instruction, the baseline is computed **as if this audit task did not exist**. This worker task is outside `aks-feature-compact-loop`, so it does not suppress any compact-loop contributor.

Observed controller-visible compact frontier at review time:

- `aks-feature-compact-loop` has **46 blocked direct children**.
- One of those children (`hold-compact-rp-cluster-lifecycle-split-frontier-20260711`) has **1 blocked child**.
- So the compact loop currently has **47 blocked descendants total**.

The assigned goal text says "45 blocked waits"; that appears stale relative to the current runtime tree.

## Bottom line

I audited the largest compact blocked-holder families that still look superficially duplicative:

1. shared underlay/runtime-input family
2. Automatic/ManagedSystem capacity family
3. shared westus2 managed-cluster capacity family
4. virtualmachines-agentpool split-frontier family
5. reviewed-exception/live-ready policy family vs machines-agentpool same-spec holder
6. node-http-proxy package-partial vs trusted-ca owner-decision wait
7. rp-cluster-lifecycle split-frontier parent + exact child wait

**Result:** I did **not** find a truthful compact-loop family holder that should be collapsed further by this review. The examined holders already separate into either:

- one shared cross-feature exact wait plus required feature-facing compact projections, or
- one feature-level split-frontier holder plus narrower exact member/sub-family waits.

Collapsing any of the examined families would hide affected feature scope, erase distinct resume conditions, or recombine same-spec/runtime/product surfaces that the current tree intentionally keeps separate.

So the durable outcome for planner review is a **no-op consolidation decision with evidence**: keep the examined families as-is, and close this audit as having verified that the current compact blocked frontier is already truthfully reduced for those largest families.

## Family findings

### 1) Shared underlay/runtime-input family

Shared exact wait:

- `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`

Compact-facing projections that reuse it:

- `hold-compact-serverless-schedulerctrl-live-workflow-frontier`
- `hold-compact-cost-analysis-reviewed-exception-frontier`
- `hold-compact-rp-cluster-lifecycle-execute-ready-octet-frontier-20260710`

Why this is **not** stale duplication:

- The shared wait is the only cross-feature owner/runtime-input family wait.
- Each compact holder is still needed to represent the feature-local blocked frontier inside `aks-feature-compact-loop`.
- The three features have different compact error classes and different affected feature scopes:
  - `serverless-schedulerctrl`: `live-workflow`
  - `cost-analysis`: `reviewed-exception`
  - `upgrade`: compact projection for `spec.upgrade.vm-prerelease-deprecated-api-detection`
- Removing the projections would break feature-first representation required by the compact-loop design.

Pre-audit contributor set:

- `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
- `hold-compact-serverless-schedulerctrl-live-workflow-frontier`
- `hold-compact-cost-analysis-reviewed-exception-frontier`
- `hold-compact-rp-cluster-lifecycle-execute-ready-octet-frontier-20260710`

Post-audit represented set:

- unchanged

Verdict: **keep all four**.

---

### 2) Automatic/ManagedSystem capacity family

Shared exact wait:

- `wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702`

Compact-facing holders:

- `hold-compact-aad-rbac-package-partial-frontier`
- `hold-compact-workload-identity-live-workflow-frontier`

Why this is **not** stale duplication:

- `hold-compact-workload-identity-live-workflow-frontier` is a pure one-carrier projection of the shared capacity family.
- `hold-compact-aad-rbac-package-partial-frontier` is broader than the shared capacity wait: it still carries the residual trio of
  - `spec.aad-rbac.azure-rbac-automatic-sku`
  - `spec.aad-rbac.managed-v2-lifecycle`
  - `spec.aad-rbac.run-command-access`
- So aad-rbac cannot be collapsed into the shared capacity wait without hiding its two additional exact downstream blockers.

Pre-audit contributor set:

- `wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702`
- `hold-compact-aad-rbac-package-partial-frontier`
- `hold-compact-workload-identity-live-workflow-frontier`

Post-audit represented set:

- unchanged

Verdict: **keep all three**.

---

### 3) Shared westus2 managed-cluster capacity family

Shared exact wait:

- `wait-shared-westus2-managed-cluster-capacity-family-return-20260703`

Compact-facing holders referencing the same lineage:

- `hold-compact-app-monitoring-westus2-managed-cluster-capacity-frontier-20260710`
- `hold-compact-windows-eligibility-frontier-20260707`

Why this is **not** stale duplication:

- `hold-compact-app-monitoring-westus2-managed-cluster-capacity-frontier-20260710` is a clean one-feature projection of the shared wait.
- `hold-compact-windows-eligibility-frontier-20260707` is **not** just a copy of the westus2 wait. It preserves a four-member Windows split frontier and cites additional exact represented carriers besides the westus2 capacity family.
- Collapsing the Windows holder into the shared westus2 family would erase the broader Windows compact scope.

Pre-audit contributor set:

- `wait-shared-westus2-managed-cluster-capacity-family-return-20260703`
- `hold-compact-app-monitoring-westus2-managed-cluster-capacity-frontier-20260710`
- `hold-compact-windows-eligibility-frontier-20260707`

Post-audit represented set:

- unchanged

Verdict: **keep all three**.

---

### 4) virtualmachines-agentpool split-frontier family

Family holder:

- `hold-compact-virtualmachines-agentpool-split-frontier-maintained-20260708b`

Exact sub-frontier holders it intentionally preserves:

- `hold-compact-virtualmachines-agentpool-auto-zone-invalidavailabilityzones-frontier-20260708`
- `hold-compact-virtualmachines-agentpool-row61-oldest-branch-runtime-frontier-20260708`
- `hold-compact-virtualmachines-agentpool-row75-row76-node-readiness-frontier-20260708`

Why this is **not** stale duplication:

- The family holder still owns the maintained 9-member compact split frontier.
- The three subordinate holders preserve materially different same-surface meanings:
  - auto-zone pair: `InvalidAvailabilityZoneFormat` API-shape rejection
  - row61: oldest-branch runtime / metrics-server `MissingEndpoints`
  - row75/76: shared run `28721673014` node-readiness failure
- The family holder acceptance explicitly says to reuse these exact waits rather than imply a new broad rerun.
- Collapsing the three sub-frontiers back into the umbrella would lose exact resume conditions.

Pre-audit contributor set:

- `hold-compact-virtualmachines-agentpool-split-frontier-maintained-20260708b`
- `hold-compact-virtualmachines-agentpool-auto-zone-invalidavailabilityzones-frontier-20260708`
- `hold-compact-virtualmachines-agentpool-row61-oldest-branch-runtime-frontier-20260708`
- `hold-compact-virtualmachines-agentpool-row75-row76-node-readiness-frontier-20260708`

Post-audit represented set:

- unchanged

Verdict: **keep all four**.

---

### 5) reviewed-exception/live-ready policy family vs machines-agentpool same-spec holder

Reviewed-exception policy family:

- `wait-compact-reviewed-exception-live-ready-policy-family-20260702`

Separate same-spec compact holder:

- `hold-compact-machines-agentpool-package-partial-frontier-202607090638`

Why this is **not** stale duplication:

- The shared policy family intentionally carries reviewed-exception siblings.
- The machines-agentpool holder intentionally carries **only** `spec.nap.default-machines-pool-cleanup-no-machine-crud` on its same-spec preflight frontier.
- Its blocker explicitly says the reviewed-exception siblings remain on the shared policy family and must **not** be recombined into this holder.

Pre-audit contributor set:

- `wait-compact-reviewed-exception-live-ready-policy-family-20260702`
- `hold-compact-machines-agentpool-package-partial-frontier-202607090638`

Post-audit represented set:

- unchanged

Verdict: **keep both**.

---

### 6) node-http-proxy package-partial holder vs exact trusted-ca owner-decision wait

Feature holder:

- `hold-compact-node-http-proxy-package-partial-frontier`

Exact downstream wait:

- `wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708`

Why this is **not** stale duplication:

- The package-partial holder is the compact-facing feature projection.
- The trusted-ca wait is the exact human owner-decision wait with repaired-transport resend proof.
- The feature holder remains needed so the compact loop still represents `node-http-proxy` as blocked for the right feature-local reason.

Pre-audit contributor set:

- `hold-compact-node-http-proxy-package-partial-frontier`
- `wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708`

Post-audit represented set:

- unchanged

Verdict: **keep both**.

---

### 7) rp-cluster-lifecycle split-frontier parent + exact child wait

Parent compact holder:

- `hold-compact-rp-cluster-lifecycle-split-frontier-20260711`

Exact blocked child:

- `domain/wait-rp-cluster-lifecycle-stop-start-ado171798563-authenticated-artifact-classification-shared-ado-auth-return-20260711`

Why this is **not** stale duplication:

- The parent is the feature-facing compact split-frontier holder.
- The child is the exact Azure DevOps artifact-classification/auth-return wait for run `171798563`.
- The parent is blocked only because the child remains blocked, which is the expected compact-holder → exact-child structure here.
- Removing the parent would hide the rp-cluster-lifecycle compact family from the compact loop; removing the child would erase the exact run-specific wait.

Pre-audit contributor set:

- `hold-compact-rp-cluster-lifecycle-split-frontier-20260711`
- `domain/wait-rp-cluster-lifecycle-stop-start-ado171798563-authenticated-artifact-classification-shared-ado-auth-return-20260711`

Post-audit represented set:

- unchanged

Verdict: **keep both**.

## What changed from this worker pass

No controller-visible compact holder was found to be a truthful duplicate that could be collapsed further without losing exact scope or resume semantics.

So this worker made **no runtime task-tree changes** and instead records the audit evidence that the examined largest families already need separate representation.

## Planner review output

Recommended planner/app-ops decision:

1. Accept this task as an evidence-backed **no-op consolidation audit**.
2. Do **not** replace any of the seven examined family groups above.
3. If desired, only refresh human-facing wording that still says "45 blocked waits" to match the current runtime count (`46` direct children / `47` descendants), but do not treat that wording mismatch as a blocked-frontier collapse opportunity by itself.

## Acceptance check against assigned task

- Reviewed the largest compact blocked-holder families: **yes**.
- Found at least one truthful duplicate holder to replace: **no**.
- Recorded why the examined families already need separate representation: **yes**.
- Preserved surviving wait owner / resume condition / affected feature scope: **yes; audit concluded those structures already remain necessary**.
- Reopened unchanged compact live work: **no**.

## Evidence used

Primary controller-visible evidence came from runtime tree inspection of `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json` and targeted holder/wait reads for the seven families above, plus the compact-loop design requirement that blocked features remain represented by feature-facing exact waits/projections rather than only by cross-feature family waits.
