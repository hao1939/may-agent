# Compact environment-overblock family consolidation — 2026-07-09o

- Task: `ops/repair-compact-environment-overblock-family-consolidation-20260709o`
- Attempt: `a_ops_repair-compact-environment-overblock-family-consolidation-20260709o_20260709115709`
- Mode: Task Worker Mode / planner-review output only
- Runtime tree mutation from this worker: none

## Executive result

I reviewed the current compact warning family after the earlier 2026-07-09 repair wave.

The most useful remaining family to repair is **`machines-agentpool`**, because it is now the clearest case where the current compact-facing holder still broadens a narrower exact frontier:

- the three reviewed-exception members already have a truthful shared family wait:
  - `wait-compact-reviewed-exception-live-ready-policy-family-20260702`
- but the one rerun-ready member `spec.nap.default-machines-pool-cleanup-no-machine-crud` no longer has its own live exact carrier
- and the current live compact holder
  - `hold-compact-machines-agentpool-package-partial-frontier-202607090638`
  mixes those two meanings back together

So the family is **not** best represented by one passive package-partial/environment-overblock holder anymore.

The truthful next planner repair is:

1. **keep** `wait-compact-reviewed-exception-live-ready-policy-family-20260702` as the single shared wait for the three reviewed-exception `machines-agentpool` members, and
2. **create one new live exact compact-facing carrier** for `spec.nap.default-machines-pool-cleanup-no-machine-crud` using the current run-`28809049156` preflight frontier semantics, or equivalently rewrite the current feature-level holder so it carries only that exact same-spec frontier and not the reviewed-exception siblings.

That is the smallest truthful live representation now.

## Why this family was chosen

Other previously noisy compact environment families are already repaired into exact compact-facing carriers in the current runtime tree:

- `app-routing` now has `wait-compact-app-routing-vm-prerelease-environment-quartet-return-20260709`
- `cluster-autoscaler` now has `wait-compact-cluster-autoscaler-vm-prerelease-environment-heptet-return-20260709`
- the reviewed-exception shared family already replaced duplicate `planned-maintenance` and `ossku-migration` holders
- `windows` and `virtualmachines-agentpool` remain truthful split-frontier holders rather than duplicate passive environment waits

`machines-agentpool` is the remaining live family where the compact-facing holder still recombines:

- one exact rerun-ready same-spec frontier, and
- a separate shared reviewed-exception family

into one broader passive holder.

## Sources reviewed

App runtime authorities:

- `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`
- `/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json`
- `/app/projects/aks-rp-e2e.app/.state/tasks/archive/done-leaves-20260707164122497.json`
- `/app/projects/aks-rp-e2e.app/.state/tasks/archive/done-leaves-20260708035707399.json`
- `/app/projects/aks-rp-e2e.app/evidence/archive/ops-repair-compact-environment-overblock-family-first-wave-20260709.md`
- `/app/projects/aks-rp-e2e.app/evidence/archive/ops-repair-compact-environment-overblock-family-20260709d.md`

Domain compact authority:

- `/app/projects/aks-rp-e2e/features/machines-agentpool/compact/staging.summary.md`

## Baseline contributor set before this task

Computed as if this audit task did not exist.

### Current live compact-facing holder

- `hold-compact-machines-agentpool-package-partial-frontier-202607090638`

Current runtime tree text says this holder is blocked because:

- the compact package still has exactly one rerun-ready member
  - `spec.nap.default-machines-pool-cleanup-no-machine-crud`
- the remaining blocker for that member is the exact scenario-local `reference/validator/request-shape` preflight failure surfaced by run `28809049156`
- **and** the broader reviewed-exception package-partial frontier still exists

### Existing shared family already present

- `wait-compact-reviewed-exception-live-ready-policy-family-20260702`

Current runtime tree text for that wait says it already represents:

- `ccp-coredns`
- the reviewed-exception siblings of `machines-agentpool`
- `planned-maintenance`
- `ossku-migration`

and explicitly says the separate same-spec `machines-agentpool` run-review wait stays outside this family.

### Stale exact carrier lineage

A prior exact carrier existed:

- `wait-compact-machines-agentpool-run-28809049156-review-20260707`

but it is now archived as `done` with stale-close lineage in `.state/tasks/archive/done-leaves-20260707164122497.json`.

So current live state has the opposite problem:

- the shared reviewed-exception family is still live and correct
- the exact same-spec frontier is still real in compact/domain state
- but the exact same-spec carrier is no longer live
- therefore the feature-level hold widened again

## Compact ground truth for machines-agentpool

`features/machines-agentpool/compact/staging.summary.md` currently says:

- 4/4 active specs are selected into the compact package
- only 1 member remains live-ready
- 3 selected members remain quarantined for live dispatch
- exact blocker kind is `repo-local-live-ready-filter`
- the 3 quarantined members are:
  - `spec.machines.agentpool-api-crud`
  - `spec.nap.default-machines-pool-cleanup-full`
  - `spec.nap.full-cleanup-source-equivalent`
- the sole rerun-ready member is:
  - `spec.nap.default-machines-pool-cleanup-no-machine-crud`

That means the family is already split by truth into **two** distinct live representations:

### A. shared reviewed-exception family

For the three quarantined members above.

### B. exact same-spec preflight frontier

For `spec.nap.default-machines-pool-cleanup-no-machine-crud`, with run `28809049156` as the current same-path proof.

## Why the current holder is over-broad

The current live holder `hold-compact-machines-agentpool-package-partial-frontier-202607090638` is not a pure duplicate, but it **recombines** two meanings that the rest of the tree already treats separately:

1. the shared reviewed-exception family already owned by `wait-compact-reviewed-exception-live-ready-policy-family-20260702`
2. the exact same-spec no-machine-crud preflight frontier proved by run `28809049156`

This is precisely the kind of compact warning-family overblock that earlier 2026-07-09 repairs removed for other features.

## Before / after task ids

### Before

Current live representation in runtime:

- `hold-compact-machines-agentpool-package-partial-frontier-202607090638`
- `wait-compact-reviewed-exception-live-ready-policy-family-20260702`

Historical exact lineage, no longer live:

- `wait-compact-machines-agentpool-run-28809049156-review-20260707` (`done` / stale-closed)

### After planner repair

Keep unchanged:

- `wait-compact-reviewed-exception-live-ready-policy-family-20260702`

Planner should add or restore one live exact compact-facing carrier for:

- `spec.nap.default-machines-pool-cleanup-no-machine-crud`

Recommended shape:

- either create a new blocked leaf dedicated to the run-`28809049156` same-spec preflight frontier
- or rewrite/rehome `hold-compact-machines-agentpool-package-partial-frontier-202607090638` so it carries only that exact same-spec frontier and no longer claims the reviewed-exception siblings

The important repair is not the exact id spelling; it is restoring **one live exact carrier** for the no-machine-crud frontier while leaving the reviewed-exception siblings only on the shared family wait.

## Exact resume condition / owner surface to preserve

### Shared family wait stays unchanged

For `wait-compact-reviewed-exception-live-ready-policy-family-20260702`, keep the current shared resume contract:

- resume only when accepted evidence reclassifies the reviewed-exception members, or a human-approved compact live-ready policy change broadens that family
- owner surface remains the human/owner-reviewed compact-policy path already recorded on the shared wait

### New exact same-spec carrier should preserve this resume condition

For the missing `spec.nap.default-machines-pool-cleanup-no-machine-crud` carrier, preserve the current runtime-tree contract already embedded in `hold-compact-machines-agentpool-package-partial-frontier-202607090638`:

- resume only if a bounded repo-local fix or accepted reclassification changes the exact `reference/validator/request-shape` preflight blocker surfaced by run `28809049156`
- do not rerun unchanged while that same-spec blocker remains unchanged
- keep the same exact evidence root:
  - run `28809049156`
  - `runs/test-results/single-nap-default-machines-pool-cleanup-no-machine-crud_449028`
  - `features/machines-agentpool/compact/staging.summary.md`
  - `features/machines-agentpool/compact/staging.diagnostics.json`

## Why the repaired family becomes the single useful live representation

After the repair, `machines-agentpool` would stop pretending to be one generic compact package-partial/environment-shaped blocker.

It would instead have exactly the two live representations that match compact ground truth:

1. **one shared family wait**
   - `wait-compact-reviewed-exception-live-ready-policy-family-20260702`
   - only for the three reviewed-exception siblings
2. **one exact same-spec carrier**
   - only for `spec.nap.default-machines-pool-cleanup-no-machine-crud`
   - only for the run-`28809049156` preflight frontier

That is now the single useful live representation because:

- every reviewed-exception member stays on the existing shared family wait
- the exact rerun-ready member regains one exact owner/action surface
- no passive compact holder needs to carry both meanings at once
- and future blocked-frontier review can reason from the real carrier instead of a recombined family shell

## Planner-ready action

The planner should add **one bounded tree repair** for `machines-agentpool`:

- keep `wait-compact-reviewed-exception-live-ready-policy-family-20260702` as the only live holder for the three reviewed-exception siblings
- create or restore one exact live compact-facing blocked carrier for `spec.nap.default-machines-pool-cleanup-no-machine-crud` using the current run-`28809049156` preflight semantics
- then remove the reviewed-exception-family meaning from `hold-compact-machines-agentpool-package-partial-frontier-202607090638` (either by replacing it or by rewriting it into that exact same-spec carrier)

## Bottom line

The `machines-agentpool` branch is the remaining compact warning family that still lacks one truthful live split:

- the shared reviewed-exception family already exists
- the exact same-spec frontier still exists in compact authority
- but there is no live exact carrier for that same-spec frontier

So the next truthful repair is **not** another broad environment-overblock family wait.
It is one exact `machines-agentpool` same-spec carrier alongside the existing shared reviewed-exception family wait.