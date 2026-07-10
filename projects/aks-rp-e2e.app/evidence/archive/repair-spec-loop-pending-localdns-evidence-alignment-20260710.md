# Repair spec-loop pending LocalDNS evidence alignment — 2026-07-10

Task: `domain/repair-spec-loop-pending-localdns-evidence-alignment-20260710`
Attempt: `a_domain_repair-spec-loop-pending-localdns-evidence-alignment-20260710_20260710151122`
Worker: `aks-explorer`

## Result

I repaired the missing **app-workspace evidence surface** for the current LocalDNS pending-family review.

After re-reading the current app-owned spec-loop state, runtime task-tree wait holders, and current LocalDNS compact/runtime context, the exact LocalDNS pending-family conclusion remains unchanged:

- **no live rerun is justified**
- **no new LocalDNS family split is needed**
- **the surviving exact waits are already the truthful current holders**
- **the missing piece was the promised app-side evidence artifact at this path**

## Scope of this alignment

This note covers the current **split-family LocalDNS pending review** that is represented by the three exact family holders below.

It does **not** widen scope to unrelated LocalDNS pending rows that already have their own separate frontiers:

- `spec.localdns.hosts-plugin` → `wait-localdns-hosts-plugin-create-http400-body-or-surface-change-20260703`
- `spec.localdns.lifecycle` → retained future-rerun frontier with `taskId=null`

## Current exact family conclusion

### 1. Managed-cluster quota/headroom family

Holder:
- `hold-spec-localdns-managed-cluster-quota-family-frontier-20260708`

Current represented specs:
- `spec.localdns.auto-default`
- `spec.localdns.cluster-topology`
- `spec.localdns.os-arch-matrix` (blocked Mariner/AzureLinux/Ubuntu residual variants)

Current spec-loop evidence:
- `spec.localdns.auto-default` still points at `taskId=hold-spec-localdns-managed-cluster-quota-family-frontier-20260708`
- `spec.localdns.cluster-topology` still points at `taskId=hold-spec-localdns-managed-cluster-quota-family-frontier-20260708`
- `spec.localdns.os-arch-matrix` still points at `taskId=hold-spec-localdns-managed-cluster-quota-family-frontier-20260708`

Current exact conclusion:
- repaired same-surface runs still stop on westus2/staging managed-cluster quota or create headroom before fresh product assertions
- no unchanged rerun is truthful until same-surface quota/headroom recovery or an owner-approved replacement target exists

Current blocker metadata already present in runtime tree:
- `owner: human`
- `resume_condition: Resume only when reviewed same-surface quota/headroom recovery proof arrives, or an owner-approved replacement target exists for the same bounded LocalDNS carriers; then reopen only the affected exact successors.`
- `next_check_at: 2026-07-10T18:00:00Z`
- `fallback_at: 2026-07-11T18:00:00Z`

### 2. Create-time HTTP 400 residual family

Holder:
- `wait-localdns-create-http400-residual-family-return-20260704`

Current represented spec:
- `spec.localdns.network-policy-coexistence`

Current spec-loop evidence:
- `spec.localdns.network-policy-coexistence` still points at `taskId=wait-localdns-create-http400-residual-family-return-20260704`

Current exact conclusion:
- the repaired family still preserves `azure-overlay` pass while the remaining bounded residual variants stop at create-time HTTP 400 before product assertions
- no unchanged rerun is truthful until one reviewed signal changes one of the remaining residual create surfaces

Current blocker metadata already present in runtime tree:
- `owner: human`
- `resume_condition: Resume only when one reviewed signal changes one of the six remaining LocalDNS create-time HTTP 400 surfaces or authoritative product/source evidence reclassifies one exact member; then reopen only that changed bounded successor instead of rerunning the full family.`
- `next_check_at: 2026-07-10T18:00:00Z`
- `fallback_at: 2026-07-11T18:00:00Z`

### 3. Reviewed-exception authoritative-return family

Holder:
- `hold-spec-localdns-reviewed-exception-authoritative-return-family-20260706c`

Current represented specs:
- `spec.localdns.multipool-consistency`
- `spec.localdns.windows-nodepool`

Current spec-loop evidence:
- `spec.localdns.multipool-consistency` still points at `taskId=hold-spec-localdns-reviewed-exception-authoritative-return-family-20260706c`
- `spec.localdns.windows-nodepool` still points at `taskId=hold-spec-localdns-reviewed-exception-authoritative-return-family-20260706c`

Current exact conclusion:
- `spec.localdns.multipool-consistency` still preserves the exact mounted `Scenario_LocalDNS_Machines` claim-narrowing boundary only
- `spec.localdns.windows-nodepool` still preserves the unsupported-product Windows LocalDNS boundary only
- no local rerun or live dispatch is truthful while the 2026-07-06 owner packet remains the active same-surface source/owner frontier

Current blocker metadata already present in runtime tree:
- `owner: human`
- `resume_condition: Resume only when Control Plane, Addon and Integrations returns one of: explicit narrowing/rehome of spec.localdns.multipool-consistency to the exact mounted Machines branch; authoritative new heterogeneous multipool LocalDNS source; explicit confirmation that Windows LocalDNS remains unsupported/nonlive; or authoritative Windows LocalDNS support evidence that overturns the current validator/agentbaker boundary.`
- `next_check_at: 2026-07-10T18:00:00Z`
- `fallback_at: 2026-07-11T18:00:00Z`

## Reconciliation against current spec-loop state

The current app-owned spec-loop state is already aligned to the same exact LocalDNS family conclusion:

- `spec.localdns.auto-default` → `hold-spec-localdns-managed-cluster-quota-family-frontier-20260708`
- `spec.localdns.cluster-topology` → `hold-spec-localdns-managed-cluster-quota-family-frontier-20260708`
- `spec.localdns.os-arch-matrix` → `hold-spec-localdns-managed-cluster-quota-family-frontier-20260708`
- `spec.localdns.network-policy-coexistence` → `wait-localdns-create-http400-residual-family-return-20260704`
- `spec.localdns.multipool-consistency` → `hold-spec-localdns-reviewed-exception-authoritative-return-family-20260706c`
- `spec.localdns.windows-nodepool` → `hold-spec-localdns-reviewed-exception-authoritative-return-family-20260706c`

So the family conclusion itself did **not** drift.

## What was actually repaired

The actionable alignment gap was evidence placement, not diagnosis:

- current spec-loop rows already point at truthful exact holders
- current runtime holders already carry precise owner/resume/fallback metadata
- the promised current review artifact in the **app** evidence workspace was missing

This file closes that evidence-surface gap.

## Remaining metadata note for planner/app-ops review

The six LocalDNS rows above still use the existing domain evidence packet as their current `successorEvidencePath`:

- `/app/projects/aks-rp-e2e/evidence/archive/reconcile-localdns-pending-current-facts-20260710b.md`

That is not a diagnosis problem. It is only an optional app-state metadata convergence step.

If planner/app-ops wants exact app-side evidence-pointer alignment later, it can repoint those six `successorEvidencePath` values to this file. This worker session did **not** mutate app loop state or task-tree metadata because the assigned task did not explicitly authorize worker-side task-tree/spec-loop write commands.

## Final conclusion

The truthful current LocalDNS pending-family review is:

1. keep the quota/headroom family holder,
2. keep the residual create-time HTTP 400 family holder,
3. keep the reviewed-exception authoritative-return family holder,
4. do not request a live rerun,
5. and use this app-workspace note as the current review artifact for the family conclusion.
