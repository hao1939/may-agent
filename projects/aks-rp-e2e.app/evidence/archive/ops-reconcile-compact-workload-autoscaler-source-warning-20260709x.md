# Ops reconcile: compact workload-autoscaler source warning — 2026-07-09

- Task: `ops/reconcile-compact-workload-autoscaler-source-warning-20260709x`
- Attempt: `a_ops_reconcile-compact-workload-autoscaler-source-warning-20260709x_20260709130154`
- Mode: worker evidence plus bounded app-side warning repair
- Runtime task-tree mutation from this worker: none

## Decision

`hold-compact-workload-autoscaler-package-partial-frontier` is already a truthful exact two-member split frontier, not a real missing-source blocker.

The smallest app-side repair is to sharpen the blocked-action warning classifier so represented split-frontier holders are not flagged as `source-exactness-overblock` noise when they already preserve their source-side member through exact represented evidence carriers.

## What I confirmed

### Live task/tree state

From `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`, the live holder `hold-compact-workload-autoscaler-package-partial-frontier` already says:

- the compact package remains partial on an exact two-member frontier;
- `spec.vpa.cert-renewal-runtime` is preserved by bounded mounted-source/public-doc evidence as a reviewed source-backed evidence ceiling;
- `spec.workload-autoscaler.keda-upgrade-survival` remains the reviewed KEDA upgrade HTTP 400 frontier;
- resume only when one of those exact member conditions changes.

Its goal and blocker text therefore describe an exact represented split frontier, not an open-ended ask for missing source proof.

### Compact artifact state

`/app/projects/aks-rp-e2e/features/workload-autoscaler/compact/staging.summary.md` already classifies this package as:

- `Kind: repo-local-spec-metadata-split-frontier`
- remaining uncovered specs:
  - `spec.vpa.cert-renewal-runtime`
  - `spec.workload-autoscaler.keda-upgrade-survival`
- frontier groups:
  - `reviewed-exception-frontier`
  - `source-equivalent-evidence-ceiling-frontier`

So the compact package itself already encodes the two-member split rather than a single generic source blocker.

### Prior accepted evidence

Both accepted notes below already concluded this warning family was materially repaired on current head:

- `/app/projects/aks-rp-e2e/evidence/archive/ops-repair-compact-workload-autoscaler-source-exactness-warning-20260709i.md`
- `/app/projects/aks-rp-e2e/evidence/archive/ops-repair-compact-workload-autoscaler-source-exactness-frontier-20260709p.md`

Those notes agree that:

- the KEDA member is already carried by its exact runtime/environment frontier;
- the VPA member is already carried by an exact source-equivalent evidence ceiling;
- no additional bounded repo-local source-authoring successor is truthful on unchanged head.

## Root cause of the warning residue

The warning residue came from the generic blocked-action classifier in `workflows/lib/task-tree-tools.ts`.

Before this repair, `blockedActionWarnings()` would flag any blocked task whose combined task text contained both:

- source-exactness signals such as `authoritative source` or `source-equivalent`; and
- blocked/external resume language such as `blocked`, `resume only when`, or `external/source`.

That logic did **not** suppress warnings for the already-supported case where the task is an exact represented split frontier. In other words, the same helper already knew how to suppress `environment-overblock` for represented split frontiers, but it did not apply that suppression to `source-exactness-overblock`.

## Repair applied

I made the smallest app-side code change in:

- `/app/projects/aks-rp-e2e.app/workflows/lib/task-tree-tools.ts`

Change:

- when a blocked task matches the source-exactness warning heuristic, skip the warning if `isRepresentedBlockedFrontier(task)` is true.

This aligns source-warning behavior with the existing represented-frontier suppression already used for environment-overblock warnings.

I also added a regression test in:

- `/app/projects/aks-rp-e2e.app/workflows/task-tree-tools.test.ts`

New test coverage asserts that a represented split frontier with source-equivalent language is **not** reported as `source-exactness-overblock`, while a separate genuine `source-exactness-blocker` task in the same packet still is.

## Why this is the right boundary

This repair is intentionally narrow:

- it does **not** relax the source-warning heuristic globally;
- it does **not** hide genuine exact-source blockers;
- it only suppresses warnings for tasks already written as exact represented split frontiers.

That matches the truthful state of `hold-compact-workload-autoscaler-package-partial-frontier` and similar holders: they are no longer asking planning to discover whether bounded progress exists, because the exact bounded members and their carriers are already explicit.

## Planner-facing outcome

- Keep `hold-compact-workload-autoscaler-package-partial-frontier` as-is.
- Do **not** create a new workload-autoscaler source-authoring successor.
- The warning-family repair is the classifier/test change above, which should stop surfacing this exact two-member split frontier as source-proof blocker noise.

## Files changed

- `workflows/lib/task-tree-tools.ts`
- `workflows/task-tree-tools.test.ts`
- `evidence/archive/ops-reconcile-compact-workload-autoscaler-source-warning-20260709x.md`
