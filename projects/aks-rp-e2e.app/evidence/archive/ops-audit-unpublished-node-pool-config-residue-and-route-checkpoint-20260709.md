# ops-audit-unpublished-node-pool-config-residue-and-route-checkpoint-20260709

Task: `ops-audit-unpublished-node-pool-config-residue-and-route-checkpoint-20260709`
Attempt: `a_ops-audit-unpublished-node-pool-config-residue-and-route-checkpoint-20260709_20260709071555`
Date: 2026-07-09

## Scope note

Worker mode forbids planner/tree reshaping from this session, so this note records:

1. the exact current 11-file unpublished domain set,
2. the truthful current owner/history for each slice,
3. the smallest next task the planner should add so the node-pool-config residue is no longer unexplained.

## 1. Exact current unpublished 11-file set

Read-only `git status --short` in `/app/projects/aks-rp-e2e` shows exactly these tracked dirty files:

```text
M features/fleet/compact/staging.diagnostics.json
M features/fleet/compact/staging.plan.json
M features/fleet/compact/staging.summary.md
M features/fleet/specs/fleet-hubless-rpapi-lifecycle.json
M features/fleet/tests/fleet-hubless-rpapi-lifecycle.ts
M features/network-cni/tests/network-cni-vm-prerelease-calico-eno-migration-matrix.ts
M features/node-pool-config/compact/staging.diagnostics.json
M features/node-pool-config/compact/staging.plan.json
M features/node-pool-config/compact/staging.summary.md
M features/node-pool-config/specs/node-pool-config-kata-vm-isolation.json
M features/node-pool-config/tests/node-pool-config-kata-vm-isolation.ts
```

So the residue splits cleanly into:

- **Fleet:** 5 files
- **network-cni:** 1 file
- **node-pool-config:** 5 files

## 2. Truthful current owner map for all 11 files

## A. Fleet slice — still active, do not mix into checkpoint

Files:

- `features/fleet/compact/staging.diagnostics.json`
- `features/fleet/compact/staging.plan.json`
- `features/fleet/compact/staging.summary.md`
- `features/fleet/specs/fleet-hubless-rpapi-lifecycle.json`
- `features/fleet/tests/fleet-hubless-rpapi-lifecycle.ts`

Current owner path in runtime task state:

- active leaf: `verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607090709`
- blocked exact frontier: `hold-compact-fleet-hubless-rpapi-version-progression-frontier-20260709`
- accepted same-path diagnosis evidence: `evidence/archive/reconcile-fleet-hubless-rpapi-update-readback-frontier-20260709b.md`

Why it is still active:

- the runtime tree shows `verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607090709` is **state=active** under `aks-feature-compact-loop`
- that task goal is to diagnose the failed compact Fleet branch and decide the smallest truthful rerun or repair
- the accepted focused diagnosis in `reconcile-fleet-hubless-rpapi-update-readback-frontier-20260709b.md` says the exact frontier remains a same-path Fleet update readback/product-assertion mismatch and **no unchanged rerun** is justified

Checkpoint posture:

- `bun scripts/domain-checkpoint.ts --json --bounded-slice feature:fleet --paths ...` returns:
  - `recommendation: "hold"`
  - `active_or_review_tasks: ["verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607090709"]`

Conclusion: the Fleet 5-file slice is still truthfully owned by active compact work and must stay out of any node-pool-config checkpoint successor.

## B. network-cni slice — still active, do not mix into checkpoint

File:

- `features/network-cni/tests/network-cni-vm-prerelease-calico-eno-migration-matrix.ts`

Current owner path in runtime task state:

- active leaf: `repair-spec-network-cni-vm-prerelease-calico-eno-pod-list-carrier-and-rerun-20260709`
- blocked related waits still present on the same spec family:
  - `review-network-cni-same-run-artifacts-wave-20260702`
  - `wait-spec-loop-network-cni-queued-same-run-family-return-20260708`
  - `wait-spec-network-cni-vm-prerelease-calico-eno-migration-ado171454434-review-20260708`

Why it is still active:

- the runtime tree shows `repair-spec-network-cni-vm-prerelease-calico-eno-pod-list-carrier-and-rerun-20260709` is **state=active**
- its goal is to repair the dedicated Calico→ENO migration carrier after run `171454434` showed invalid kubectl argument ordering, then rerun only that spec

Checkpoint posture:

- `bun scripts/domain-checkpoint.ts --json --bounded-slice feature:network-cni --paths ...` returns:
  - `recommendation: "hold"`
  - `active_or_review_tasks: ["repair-spec-network-cni-vm-prerelease-calico-eno-pod-list-carrier-and-rerun-20260709"]`
  - blocked task references still present on the same family

Conclusion: the single network-cni dirty file is still active repair residue and must stay out of any node-pool-config checkpoint successor.

## C. node-pool-config slice — produced by accepted work, currently lacks a live owner path

Files:

- `features/node-pool-config/compact/staging.diagnostics.json`
- `features/node-pool-config/compact/staging.plan.json`
- `features/node-pool-config/compact/staging.summary.md`
- `features/node-pool-config/specs/node-pool-config-kata-vm-isolation.json`
- `features/node-pool-config/tests/node-pool-config-kata-vm-isolation.ts`

Exact producing task/history:

- producing leaf: `repair-node-pool-config-kata-vm-isolation-mounted-contract-20260709`
- accepted evidence: `evidence/archive/repair-node-pool-config-kata-vm-isolation-mounted-contract-20260709.md`
- rollup archive: `.state/tasks/archive/done-leaves-20260709051408840.json`

What that accepted task says it changed:

- repaired `spec.node-pool-config.kata-vm-isolation` to the exact mounted `Scenario_Kata_VM_Isolation` contract
- repaired the feature-owned test carrier to `KataVmIsolation + kata-vm-isolation`
- regenerated the node-pool-config compact package
- recorded the changed outputs as:
  - `features/node-pool-config/specs/node-pool-config-kata-vm-isolation.json`
  - `features/node-pool-config/tests/node-pool-config-kata-vm-isolation.ts`
  - `features/node-pool-config/compact/staging.plan.json`
  - `features/node-pool-config/compact/staging.summary.md`
  - `features/node-pool-config/compact/staging.diagnostics.json`

The archived owner review explicitly accepted that result:

> "Accepted mounted-source Kata repair: the node-pool-config spec/test/compact package were updated to the exact Scenario_Kata_VM_Isolation contract, bounded overclaim was removed, and the evidence packet documents the truthful successor surface."

That accepted leaf is now rolled up and no active same-scope node-pool-config owner remains in the runtime tree.

Checkpoint posture:

- `bun scripts/domain-checkpoint.ts --json --bounded-slice feature:node-pool-config --paths ...` returns:
  - `recommendation: "candidate"`
  - `active_or_review_tasks: []`
  - `blocked_tasks: []`

Conclusion: these five dirty node-pool-config files are **not** still-active Fleet/network-cni work. They are the accepted but unpublished output of the mounted-contract Kata repair and therefore need their own explicit checkpoint/publication owner.

## 3. Why the unpublished metric is currently unexplained

The red unpublished-change surface is currently understandable for Fleet and network-cni because both still map to active/runtime-held owner paths.

The gap is node-pool-config:

- the five node-pool-config files are still dirty in git,
- but their producing task was already accepted and archived,
- and no current active/blocked node-pool-config leaf in the runtime tree claims those exact outputs as remaining work.

So the residue is real, but the current task tree no longer gives it a visible live owner path. That is the unexplained part this audit was asked to resolve.

## 4. Smallest truthful next step the planner should add

Because worker mode forbids tree mutation here, I am not adding the task directly. The planner should add **one exact checkpoint successor** for the accepted node-pool-config residue only.

Recommended new leaf:

- **id (suggested):** `checkpoint-unpublished-node-pool-config-kata-mounted-contract-slice-20260709`
- **owner:** `aks-explorer`
- **kind:** `domain_leaf`
- **scope:** only the five node-pool-config files listed above

Suggested goal text:

> Checkpoint the accepted node-pool-config Kata mounted-contract repair as one bounded unpublished slice by publishing only the five repaired node-pool-config spec/test/compact files, without mixing in the still-active Fleet or network-cni residue.

Suggested inputs:

- `evidence/archive/repair-node-pool-config-kata-vm-isolation-mounted-contract-20260709.md`
- `.state/tasks/archive/done-leaves-20260709051408840.json`
- current dirty files:
  - `features/node-pool-config/compact/staging.diagnostics.json`
  - `features/node-pool-config/compact/staging.plan.json`
  - `features/node-pool-config/compact/staging.summary.md`
  - `features/node-pool-config/specs/node-pool-config-kata-vm-isolation.json`
  - `features/node-pool-config/tests/node-pool-config-kata-vm-isolation.ts`

Suggested acceptance:

1. Recheck that the node-pool-config dirty slice is still exactly those five files and still excludes Fleet + network-cni.
2. Publish/checkpoint only that five-file slice, citing the accepted mounted-contract Kata repair as its authority.
3. Record the resulting commit / publication evidence and restate the remaining dirty frontier as Fleet + network-cni only.

Why this is the smallest truthful route:

- it matches the accepted node-pool-config task outputs exactly,
- `domain-checkpoint` classifies the slice as a **candidate** rather than a hold,
- it makes the accepted repo changes visible,
- and it avoids mixing the still-active Fleet and network-cni residue into a false shared checkpoint.

## 5. Bottom line

The current 11-file unpublished set maps truthfully as:

- **Fleet (5 files): hold / active compact diagnosis**
- **network-cni (1 file): hold / active same-path carrier repair**
- **node-pool-config (5 files): accepted Kata mounted-contract repair outputs with no current live owner path**

So the correct routing is:

- keep Fleet and network-cni under their current active holders,
- add one exact checkpoint successor for the five-file node-pool-config slice,
- and do not narrate the node-pool-config residue as still part of Fleet or network-cni work.
