# Cluster-autoscaler compact environment-overblock family audit — 2026-07-09

- Task: `ops-audit-compact-cluster-autoscaler-environment-overblock-family-20260709`
- Attempt: `a_ops-audit-compact-cluster-autoscaler-environment-overblock-family-20260709_20260709100325`
- Mode: Task Worker Mode / planner-review output only
- Runtime tree mutation from this worker: none

## Result

I audited the current `cluster-autoscaler` compact package-partial environment-overblock family.

### Exact residual accepted-environment-blocked members

The current compact ground truth still preserves exactly these **seven** residual `accepted-environment-blocked-frontier` members inside the live compact holder:

1. `spec.cluster-autoscaler.vm-prerelease-autoscaling-base`
2. `spec.cluster-autoscaler.vm-prerelease-local-storage-runtime`
3. `spec.cluster-autoscaler.vm-prerelease-mincount-recovery`
4. `spec.cluster-autoscaler.vm-prerelease-row49-overscale-node-stability`
5. `spec.cluster-autoscaler.vm-prerelease-scale-from-zero-labels-fips`
6. `spec.cluster-autoscaler.vm-prerelease-service-principal`
7. `spec.cluster-autoscaler.vm-prerelease-spot`

### Family decision

There is **no single existing shared wait** in the live runtime tree that truthfully carries all seven members together.

However, these seven members are **already represented by seven existing exact spec-level blocked waits/holds**. So the truthful next planner action is **not** to invent another broad compact environment wait and **not** to leave the generic feature-level compact holder as the only visible carrier.

The truthful planner action is to:

1. keep the seven exact downstream waits/holds as the real owner/problem surfaces,
2. replace or rewrite the current feature-level compact holder so it explicitly projects to those seven exact carriers, and
3. if the planner wants one compact-facing family carrier, make it a **narrow exact seven-member frontier carrier** whose text and links point at the seven existing exact waits instead of another passive package-partial/environment-overblock holder.

## Sources reviewed

### App runtime authorities

- `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`
- `/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json`
- `/app/projects/aks-rp-e2e.app/.state/spec-loop/state.json`

### Domain authorities

- `/app/projects/aks-rp-e2e/features/cluster-autoscaler/compact/staging.summary.md`
- `/app/projects/aks-rp-e2e/features/cluster-autoscaler/compact/staging.diagnostics.json`
- `/app/projects/aks-rp-e2e/evidence/archive/reconcile-spec-loop-pending-cluster-autoscaler-family-20260709.md`
- `/app/projects/aks-rp-e2e/evidence/archive/reconcile-spec-loop-cluster-autoscaler-blocked-frontier-family-20260709.md`

### Prior app-ops context

- `/app/projects/aks-rp-e2e.app/evidence/archive/ops-audit-compact-environment-overblock-warning-family-20260709.md`
- `/app/projects/aks-rp-e2e.app/evidence/archive/ops-classify-compact-environment-overblock-family-20260709.md`
- `/app/projects/aks-rp-e2e.app/evidence/archive/ops-rebind-compact-environment-overblock-exact-waits-20260709.md`

## Baseline contributor set before this audit

Per the task instruction, computed as if this audit task did not exist.

### Pre-audit family contributor in app runtime

- `hold-compact-cluster-autoscaler-package-partial-frontier-202607090657`

This live holder currently carries the entire cluster-autoscaler compact residue and is the leaf that makes the warning family look like one broad compact environment blocker.

### Why it is over-broad

The maintained compact package no longer has a generic unresolved package-partial problem. It has one exact surviving live-dispatch frontier:

- one `accepted-environment-blocked-frontier`
- containing exactly the seven members listed above
- each of which already has an exact downstream blocked wait or reviewed frontier

So the feature-level holder is still truthful about *membership*, but it is too broad as the primary actionable carrier because it hides the actual owner/problem surfaces.

## Ground truth from compact package

`features/cluster-autoscaler/compact/staging.summary.md` says:

- package status = `partial`
- 25 selected specs, 18 live-ready, 7 quarantined
- exact blocker kind = `repo-local-spec-metadata-single-frontier`
- truthful remaining frontier = `accepted-environment-blocked-frontier`
- exact remaining uncovered specs are the seven members listed above

`features/cluster-autoscaler/compact/staging.diagnostics.json` repeats the same truth:

- `selectionBlocker.kind = repo-local-spec-metadata-single-frontier`
- `selectionBlocker.frontierGroups[0].bucket = accepted-environment-blocked-frontier`
- the same seven exact `specIds`
- resume condition: resume only by taking the exact owner action implied by the preserved frontier, or by intentionally changing the compact live-ready filter contract for that frontier

So the compact package itself already proves that the truthful family is the exact seven-member frontier, not a generic package-partial rerun problem.

## Exact existing carriers for each residual member

The seven members are already represented in the runtime tree by exact waits/holds:

| Residual compact member | Existing exact carrier | Current meaning |
| --- | --- | --- |
| `spec.cluster-autoscaler.vm-prerelease-autoscaling-base` | `wait-spec-cluster-autoscaler-vm-prerelease-autoscaling-base-reference-preflight-portability-return-20260708` | exact same-surface reference-preflight portability blocker |
| `spec.cluster-autoscaler.vm-prerelease-local-storage-runtime` | `wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708` | exact create-stage HTTP 400 environment frontier |
| `spec.cluster-autoscaler.vm-prerelease-mincount-recovery` | `wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708` | exact preview-header / create-stage HTTP 400 environment frontier |
| `spec.cluster-autoscaler.vm-prerelease-row49-overscale-node-stability` | `hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708` | exact reviewed environment frontier for row49 |
| `spec.cluster-autoscaler.vm-prerelease-scale-from-zero-labels-fips` | `hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708` | exact reviewed frontier for row50 FIPS |
| `spec.cluster-autoscaler.vm-prerelease-service-principal` | `wait-spec-cluster-autoscaler-vm-prerelease-service-principal-reference-preflight-portability-return-20260708` | exact same-surface reference-preflight portability blocker |
| `spec.cluster-autoscaler.vm-prerelease-spot` | `wait-spec-cluster-autoscaler-vm-prerelease-spot-reference-preflight-portability-return-20260708` | exact same-surface reference-preflight portability blocker |

## Why no existing shared wait already truthfully carries the whole family

A truthful reusable shared carrier would need all of the following:

1. exact affected scope = these same seven specs,
2. live runtime presence now,
3. resume condition broad enough to cover all seven exact waits without erasing their meaning,
4. no stale older compact-run lineage, and
5. no contradiction with the newer compact package truth that already points to these seven exact spec-level surfaces.

No current live wait in the tree satisfies all five conditions.

### What exists today instead

What exists today is a **represented exact family**, not a single shared wait:

- 3 exact portability waits
- 2 exact create-stage environment waits
- 2 exact reviewed environment frontiers

So the family is already decomposed correctly at the exact leaf level, but the compact-facing holder has not yet been rebound to those exact leaves.

## Why the older compact-family holder is not the right carrier as-is

There is older lineage around:

- `hold-compact-cluster-autoscaler-vm-prerelease-current-head-frontier-20260707`

Earlier domain evidence used a `3+3+1` explanation for the VM-prerelease family. But the **current** maintained compact summary/diagnostics now preserve one accepted-environment-blocked seven-member frontier, while the current tree already exposes the exact seven downstream waits listed above.

So planner should not blindly restore older wording as the live carrier without updating it to the current seven-member exact frontier projection.

## Actionable decomposition hidden by the current feature-level holder

The current generic compact holder hides three distinct actionable owner/problem classes:

### A) Reference-preflight portability branch

Members:

- `spec.cluster-autoscaler.vm-prerelease-autoscaling-base`
- `spec.cluster-autoscaler.vm-prerelease-service-principal`
- `spec.cluster-autoscaler.vm-prerelease-spot`

Exact downstream carriers already exist and all point at the same class of issue:

- same-surface reference-preflight portability on the remote runner

### B) Create-stage environment branch

Members:

- `spec.cluster-autoscaler.vm-prerelease-local-storage-runtime`
- `spec.cluster-autoscaler.vm-prerelease-mincount-recovery`

Exact downstream carriers already exist and both preserve create-stage `HTTP 400` environment frontiers.

### C) Reviewed environment frontier branch

Members:

- `spec.cluster-autoscaler.vm-prerelease-row49-overscale-node-stability`
- `spec.cluster-autoscaler.vm-prerelease-scale-from-zero-labels-fips`

Exact downstream carriers already exist and both preserve reviewed environment-only frontiers.

This is why the feature-level holder still overblocks: it suppresses the visible distinction between exact portability repair, exact create-stage environment recovery, and exact reviewed environment frontier branches.

## Planner-ready repair

Because no single truthful shared wait already carries the family, planner/app-ops should use **one narrower owner/problem carrier** only if it is a projection surface over the seven exact waits above.

### Minimum truthful carrier shape

Suggested compact-facing carrier purpose:

> Preserve one exact blocked holder for the cluster-autoscaler accepted environment-blocked seven-member compact frontier so compact cluster-autoscaler can project to the real exact waits without reopening an unchanged broad compact rerun.

### Exact affected scope

- `spec.cluster-autoscaler.vm-prerelease-autoscaling-base`
- `spec.cluster-autoscaler.vm-prerelease-local-storage-runtime`
- `spec.cluster-autoscaler.vm-prerelease-mincount-recovery`
- `spec.cluster-autoscaler.vm-prerelease-row49-overscale-node-stability`
- `spec.cluster-autoscaler.vm-prerelease-scale-from-zero-labels-fips`
- `spec.cluster-autoscaler.vm-prerelease-service-principal`
- `spec.cluster-autoscaler.vm-prerelease-spot`

### Exact downstream wait set this carrier should point at

- `wait-spec-cluster-autoscaler-vm-prerelease-autoscaling-base-reference-preflight-portability-return-20260708`
- `wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708`
- `wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708`
- `hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708`
- `hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708`
- `wait-spec-cluster-autoscaler-vm-prerelease-service-principal-reference-preflight-portability-return-20260708`
- `wait-spec-cluster-autoscaler-vm-prerelease-spot-reference-preflight-portability-return-20260708`

### Resume condition the carrier should preserve

A truthful compact-facing carrier should say something materially equivalent to:

> Resume only when reviewed evidence changes one or more of the seven exact downstream blocked waits/frontiers, or when the compact live-ready filter contract is intentionally changed for this exact seven-member frontier. Do not reopen an unchanged broad compact rerun.

### Why this carrier is better than the current one

It would still preserve one compact-side family surface, but it would no longer hide the actionable downstream work because it would explicitly project to the seven existing exact carriers.

## Post-action represented set planner should aim for

### Before

- `hold-compact-cluster-autoscaler-package-partial-frontier-202607090657`
  - carries the whole seven-member frontier as one feature-level compact package-partial holder

### After

Keep the seven exact spec-level waits/holds listed above as the real downstream carriers.

Then either:

1. rewrite `hold-compact-cluster-autoscaler-package-partial-frontier-202607090657` so it explicitly inherits those seven exact carriers, **or**
2. replace it with one new compact-facing exact seven-member frontier carrier that names those seven exact waits directly.

In either case, the post-action represented set should be:

- one compact-facing exact seven-member frontier projection surface, plus
- the seven existing exact spec-level waits/holds

and **not** another passive broad package-partial/environment-overblock holder.

## Bottom line

The exact residual cluster-autoscaler compact environment-overblock family is this seven-member set:

- `spec.cluster-autoscaler.vm-prerelease-autoscaling-base`
- `spec.cluster-autoscaler.vm-prerelease-local-storage-runtime`
- `spec.cluster-autoscaler.vm-prerelease-mincount-recovery`
- `spec.cluster-autoscaler.vm-prerelease-row49-overscale-node-stability`
- `spec.cluster-autoscaler.vm-prerelease-scale-from-zero-labels-fips`
- `spec.cluster-autoscaler.vm-prerelease-service-principal`
- `spec.cluster-autoscaler.vm-prerelease-spot`

There is **no single live shared wait** that truthfully carries all seven together today.

But there **is** already a truthful exact represented set: seven existing spec-level waits/holds, one for each residual member.

So the planner should **not** create another broad environment-overblock umbrella and should **not** leave the current feature-level compact holder as the only visible carrier. Instead, planner should **replace or rewrite that holder into one compact-facing exact seven-member frontier projection** that explicitly points at the seven existing exact waits above.