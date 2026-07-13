# Normalize shared cluster-autoscaler VM-prerelease environment frontier family — 2026-07-10

Task: `ops/normalize-shared-cluster-autoscaler-vm-prerelease-environment-frontier-family-20260710`
Attempt: `a_ops_normalize-shared-cluster-autoscaler-vm-prerelease-environment-frontier-family-20260710_20260710230019`

## Worker-mode boundary

This task asks for blocker-family normalization across live task-tree leaves. In Task Worker Mode, I did **not** reshape the runtime tree or create/reassign tasks from this session. This memo records the exact current semantics, the consolidation decision, and the minimum planner-side linkage that should exist.

## Decision

**One family-level wait cannot truthfully replace both current holders without losing scope and causing loop-controller drift/recreation.**

The truthful minimum shape is **dual-holder, cross-linked**:

1. keep the exact spec holder
   - `hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708`
2. keep one compact-facing holder for the seven-member VM-prerelease compact frontier
   - `hold-compact-cluster-autoscaler-vm-prerelease-environment-heptet-frontier-20260710`
3. make the compact-facing holder explicitly project to the seven exact downstream carriers, including the row49 spec holder, so blocked-frontier review treats them as **one blocker family with one compact projection plus exact downstream leaves**, not as two independently rediscovered problems.

## Why a single shared wait is not truthful

### A. The spec holder and compact holder do not have the same scope

The live exact spec holder is still a **single-spec** environment frontier:

- `hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708`
- goal: preserve the exact reviewed environment frontier for `spec.cluster-autoscaler.vm-prerelease-row49-overscale-node-stability`
- conflict scope: `spec:spec.cluster-autoscaler.vm-prerelease-row49-overscale-node-stability`

That holder is the truthful spec-loop carrier for one exact row-49 spec only.

By contrast, the compact authority still says cluster-autoscaler package truth is a **seven-member accepted-environment-blocked frontier**:

- `spec.cluster-autoscaler.vm-prerelease-autoscaling-base`
- `spec.cluster-autoscaler.vm-prerelease-local-storage-runtime`
- `spec.cluster-autoscaler.vm-prerelease-mincount-recovery`
- `spec.cluster-autoscaler.vm-prerelease-row49-overscale-node-stability`
- `spec.cluster-autoscaler.vm-prerelease-scale-from-zero-labels-fips`
- `spec.cluster-autoscaler.vm-prerelease-service-principal`
- `spec.cluster-autoscaler.vm-prerelease-spot`

So the row49 spec holder cannot replace the compact frontier without dropping six exact blocked members.

### B. The compact loop has its own controller-visible semantics

`features/cluster-autoscaler/compact/staging.summary.md` and `staging.diagnostics.json` still declare:

- package status = `partial`
- exact blocker kind = `repo-local-spec-metadata-single-frontier`
- exact frontier group = `accepted-environment-blocked-frontier`
- remaining uncovered members = the same seven VM-prerelease specs above
- resume condition = change one exact member of that frontier, or intentionally change the compact live-ready filter contract

So even if row49 stayed as the only visible live wait, the compact loop would still regenerate a seven-member compact frontier because the compact packet remains package-partial for all seven quarantined members, not only row49.

### C. Replacing the spec holder with one family wait would erase exact spec truth

If planner collapsed the row49 leaf into only the compact-facing family wait:

- spec-loop would lose the exact reviewed environment frontier for `spec.cluster-autoscaler.vm-prerelease-row49-overscale-node-stability`
- the surviving compact holder would overstate scope for spec-loop purposes
- spec-loop/canonical reviewed-exception logic would have reason to recreate or continue preserving the exact row49 leaf anyway

That is the churn risk the task asked about.

### D. Replacing the compact holder with only the spec holder would underrepresent compact truth

If planner collapsed the compact-facing frontier into only the row49 spec holder:

- compact cluster-autoscaler would falsely appear blocked on just row49
- the six other quarantined VM-prerelease members would become invisible at the compact projection surface
- the feature-compact loop would keep needing to regenerate a seven-member package-partial frontier

So the family cannot be reduced to the row49 spec leaf alone.

## Exact current evidence

### 1. Exact row49 spec holder still exists and is truthful as a spec-scoped wait

Current live tree facts show:

- id: `hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708`
- state: `blocked`
- parent: `aks-spec-verification-loop`
- owner: `aks-explorer`
- goal: preserve the exact reviewed environment frontier for `spec.cluster-autoscaler.vm-prerelease-row49-overscale-node-stability`

That is exact spec-scope truth and should remain.

### 2. Compact ground truth remains seven-member, not row49-only

Current compact packet authority still says the exact remaining frontier is the seven-member VM-prerelease `accepted-environment-blocked-frontier` listed above.

That means one compact-facing holder is still needed, but it must stay explicitly seven-member.

### 3. Prior accepted lineage already proved the compact-facing holder should project to exact downstream carriers

Accepted archive evidence for the prior compact wait and its replacement records the intended exact downstream set:

1. `domain/queue-cluster-autoscaler-autoscaling-base-post-portability-rerun-20260710`
2. `wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708`
3. `wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708`
4. `hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708`
5. `hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708`
6. `ops/repair-ado-sp-credential-env-contract-pipeline-467665-20260710`
7. `domain/queue-cluster-autoscaler-spot-post-portability-rerun-20260710`

This is the exact cross-link shape that preserves one compact family surface while still pointing to the real downstream owner/problem leaves.

### 4. Current controller-visible projection is still drifted

Current `.state/feature-compact-loop/state.json` shows:

- `taskId = hold-compact-cluster-autoscaler-vm-prerelease-environment-heptet-frontier-20260710`
- but `frontierTaskIds` still contain:
  - `hold-spec-cluster-autoscaler-provisioning-request-http400-environment-frontier-20260709`
  - `ops/wait-runtime-owner-stale-workflow-run-row-closure-return-20260710`
  - row49 / FIPS / local-storage / mincount
- and omit autoscaling-base / service-principal successor / spot successor

So the family representation is still semantically drifted. That drift is another reason a one-holder collapse is unsafe right now: the family needs exact projection repair, not further consolidation.

### 5. Current live compact holder text also does not yet carry the full seven-member semantics

The current live tree entry for:

- `hold-compact-cluster-autoscaler-vm-prerelease-environment-heptet-frontier-20260710`

still carries generic package-partial wording focused on row49/current-head frontier language rather than the exact seven-member downstream-carrier wording recorded in accepted apply/archive evidence.

So the durable truth is not “replace both holders with one family wait.”
The durable truth is “keep both scopes and repair their linkage so the compact holder truthfully references the exact downstream family.”

## Minimum exact dual-holder shape planner should preserve

### Holder 1 — exact spec leaf

Keep unchanged:

- `hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708`

Reason:

- exact spec-scope carrier for `spec.cluster-autoscaler.vm-prerelease-row49-overscale-node-stability`
- truthful spec-loop frontier
- should not be widened into a seven-member family leaf

### Holder 2 — compact-facing family projection leaf

Keep as the compact projection surface:

- `hold-compact-cluster-autoscaler-vm-prerelease-environment-heptet-frontier-20260710`

But its blocker/resume text and controller-visible projection should explicitly carry the exact seven-member downstream family:

1. `domain/queue-cluster-autoscaler-autoscaling-base-post-portability-rerun-20260710`
2. `wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708`
3. `wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708`
4. `hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708`
5. `hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708`
6. `ops/repair-ado-sp-credential-env-contract-pipeline-467665-20260710`
7. `domain/queue-cluster-autoscaler-spot-post-portability-rerun-20260710`

### Required cross-link meaning

The compact-facing holder should say, materially:

> Compact cluster-autoscaler remains package-partial only because these exact seven VM-prerelease downstream carriers remain unresolved. Row49 is one exact member of that family, not the whole family. Provisioning-request and stale-workflow waits are separate and must not stand in for this frontier.

That gives blocked-frontier review one family-level compact projection without pretending the row49 spec leaf alone can carry the whole family.

## Planner-side apply recommendation

Because this worker session is not authorized to reshape the live tree, the smallest truthful planner/app-ops action is:

1. **Do not retire** `hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708` in favor of the compact holder.
2. **Do not retire** `hold-compact-cluster-autoscaler-vm-prerelease-environment-heptet-frontier-20260710` in favor of the row49 holder.
3. **Repair** the compact-facing holder text and `.state/feature-compact-loop/state.json` `frontierTaskIds` so they point at the exact seven downstream carriers listed above.
4. Optionally add a short acceptance/context note on the compact-facing holder that row49 is one member of the seven-member family and that the exact row49 spec leaf remains the spec-loop owner for that one surface.

## Bottom line

The repeated cluster-autoscaler VM-prerelease environment frontier should **not** be normalized into one shared leaf that replaces both current holders.

Truthful durable shape is:

- **one exact spec holder** for row49, and
- **one compact-facing family projection holder** for the seven-member VM-prerelease compact frontier,
- with explicit downstream linkage so future blocked-frontier reviews treat them as one blocker family rather than two independent discoveries.

That is the minimum exact dual-holder shape that preserves scope truth and avoids controller churn.
