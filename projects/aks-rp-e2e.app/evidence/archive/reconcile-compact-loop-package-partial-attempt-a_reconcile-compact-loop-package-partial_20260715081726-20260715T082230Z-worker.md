# Reconcile compact loop package-partial sampled frontier — retry repair for attempt `a_reconcile-compact-loop-package-partial_20260715081726`

- Task: `reconcile-compact-loop-package-partial`
- Attempt: `a_reconcile-compact-loop-package-partial_20260715081726`
- Worker: `aks-explorer`
- Timestamp: `2026-07-15T08:22:30Z`
- Subject: feature family `package-partial` on target `staging` / branch `dev`
- Scope: app-owned compact-loop state for `egress-lockdown`, `machines-agentpool`, `net-integration`, `rp-nodepool-lifecycle`, and `traffic-alb-controller`

## Read-order notes

- Read `model/knowledge-map/README.md`.
- The canonical `replays/execution/automation.md` path is absent in the domain root, so I used the repo-local copy at `workspace/task-publish-kms-repair/publish/replays/execution/automation.md` for the required operating-model read.
- Re-read the rejected evidence note and the current app-owned state before making changes.

## Exact subject

One coherent feature family: `package-partial`.

## Failure classification

`other-known-class` — current task-context/evidence drift, not an AKS product rerun candidate.

Specific diagnosis: the previous completion mixed two truths. The diagnostics really do still advertise non-empty rerun-ready subsets for all five sampled features, but the controller-visible state does **not** currently persist `compactLiveReadiness`, `compactSelectionCoverage`, `selectionBlocker`, `packageStatus`, or `liveDispatchGate` for any feature row. The prior memo incorrectly claimed those diagnostics-derived structures were written into state, and it also claimed `frontierTaskIds` had been normalized for three rows that still had `[]`.

## Input fingerprint / error fingerprint comparison before any rerun

No live rerun was launched in this retry.

- Input fingerprints: unchanged for all five sampled features versus the task context.
- Error fingerprints:
  - `egress-lockdown`: unchanged exact wait / same result path.
  - `machines-agentpool`: unchanged exact same-spec preflight-blocked carrier / same result path.
  - `net-integration`: unchanged exact environment-registration frontier / same result path.
  - `rp-nodepool-lifecycle`: current state already reflects the narrowed single rollback frontier rather than the older broader mixed-frontier wording in task context.
  - `traffic-alb-controller`: unchanged cleanup-only authority-gap carrier / same result path.

Because no sampled feature gained changed input, a changed same-surface diagnosis, or a new external fact that would make a bounded rerun truthful, the smallest truthful action remained state/evidence repair only.

## What this retry repaired

### 1. Fresh-attempt evidence path

This memo is new for the current attempt and is now the controller-visible `reviewEvidencePath` for all five sampled feature rows:

`evidence/archive/reconcile-compact-loop-package-partial-attempt-a_reconcile-compact-loop-package-partial_20260715081726-20260715T082230Z-worker.md`

### 2. `frontierTaskIds` writeback now matches the exact holders

Updated app-owned state rows now preserve these exact holder arrays:

- `egress-lockdown` → `frontierTaskIds=["wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702"]`
- `machines-agentpool` → `frontierTaskIds=["wait-compact-machines-agentpool-run-28809049156-review-20260714"]`
- `net-integration` → `frontierTaskIds=["hold-compact-net-integration-package-partial-frontier"]`
- `rp-nodepool-lifecycle` → `frontierTaskIds=["hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707"]`
- `traffic-alb-controller` → `frontierTaskIds=["hold-compact-traffic-alb-controller-package-partial-frontier"]`

### 3. State/evidence contract clarified

The app-owned state remains the same controller-visible contract it already used before this retry:

- exact holder / frontier fields (`taskId`, `frontierTaskIds`)
- classification and resume text (`rootCauseClassification`, `ownerReason`, `nextStepClassification`, `resumeCondition`, `verificationBlocker`)
- evidence pointers (`reviewEvidencePath`, `evidencePaths`, `updatedAt`, `lastCheckedAt`, `summary`, `lastSummary`)

The following structures remain **diagnostics-only** in the current repo/app contract and were **not** written into `.state/feature-compact-loop/state.json` during this retry:

- `compactLiveReadiness`
- `compactSelectionCoverage`
- `selectionBlocker`
- `packageStatus`
- `liveDispatchGate`

Verification readback after the state repair shows non-null global state counts of `0` for all five of those fields across the full app-owned compact-loop state, so this memo intentionally treats them as diagnostics authority rather than claiming a state writeback that did not occur.

## Per-feature preserved raw facts

### egress-lockdown

- Exact holder in state: `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`
- `frontierTaskIds`: `["wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702"]`
- Result path: `.state/feature-compact-loop/artifacts/171607915/runs/test-results/feature-compact-egress-lockdown-staging_249481/result.json`
- Target / branch: `staging` / `dev`
- Diagnostics package status: `partial`
- Diagnostics blocker kind: `repo-local-live-ready-filter`
- Diagnostics ready subset: `spec.egress-lockdown.vm-prerelease-vhd-matrix` (count `1`)
- Command surface if ever rerun later: `bun run execute features/egress-lockdown/compact/staging.plan.json --parallel=50`
- Current truthful decision: exact wait preserved; no rerun.

### machines-agentpool

- Exact holder in state: `wait-compact-machines-agentpool-run-28809049156-review-20260714`
- `frontierTaskIds`: `["wait-compact-machines-agentpool-run-28809049156-review-20260714"]`
- Result path: `runs/test-results/single-nap-default-machines-pool-cleanup-no-machine-crud_449028`
- Target / branch: `staging` / `dev`
- Diagnostics package status: `partial`
- Diagnostics blocker kind: `repo-local-live-ready-filter`
- Diagnostics ready subset: `spec.nap.default-machines-pool-cleanup-no-machine-crud` (count `1`)
- Command surface if ever rerun later: `bun run execute features/machines-agentpool/compact/staging.plan.json --parallel=50`
- Current truthful decision: exact same-spec wait preserved; no rerun.

### net-integration

- Exact holder in state: `hold-compact-net-integration-package-partial-frontier`
- `frontierTaskIds`: `["hold-compact-net-integration-package-partial-frontier"]`
- Result path: `.state/feature-compact-loop/artifacts/171742498/runs/test-results/feature-compact-net-integration-staging_246969/result.json`
- Target / branch: `staging` / `dev`
- Diagnostics package status: `partial`
- Diagnostics blocker kind: `repo-local-mixed-terminal-and-promotion-frontier`
- Diagnostics ready subset count: `34`
- Current exact preserved environment wait: reviewed confirmation of `Microsoft.ContainerService/NetworkingMultiNICPreview` registration on subscription `26fe00f8-9173-4872-9134-bb1d2e00343a` (or reviewed equivalent replacement environment) before reopening the MultiNIC dualstack/mixed pair.
- Command surface if ever rerun later: `bun run execute features/net-integration/compact/staging.plan.json --parallel=50`
- Current truthful decision: exact frontier preserved; no rerun.

### rp-nodepool-lifecycle

- Exact holder in state: `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707`
- `frontierTaskIds`: `["hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707"]`
- Result path: `.state/feature-compact-loop/artifacts/171742526/runs/test-results/feature-compact-rp-nodepool-lifecycle-staging_229423/result.json`
- Target / branch: `staging` / `dev`
- Diagnostics package status: `partial`
- Diagnostics blocker kind: `repo-local-spec-metadata-single-frontier`
- Diagnostics ready subset count: `6`
- Ready subset: `spec.rp-nodepool-lifecycle.add-remove`, `spec.rp-nodepool-lifecycle.agentpool-operations`, `spec.rp-nodepool-lifecycle.agentpool-upgrade-resume`, `spec.rp-nodepool-lifecycle.multi-agentpool-runner`, `spec.rp-nodepool-lifecycle.scale-manual`, `spec.rp-nodepool-lifecycle.upgrade-nodeimage`
- Command surface if ever rerun later: `bun run execute features/rp-nodepool-lifecycle/compact/staging.plan.json --parallel=50`
- Current truthful decision: single rollback wait remains exact; six ready members stay diagnostics metadata only until changed input or a reviewed rerun plan exists.

### traffic-alb-controller

- Exact holder in state: `hold-compact-traffic-alb-controller-package-partial-frontier`
- `frontierTaskIds`: `["hold-compact-traffic-alb-controller-package-partial-frontier"]`
- Result path: `runs/test-results/feature-compact-traffic-alb-controller-staging_007672`
- Target / branch: `staging` / `dev`
- Diagnostics package status: `partial`
- Diagnostics blocker kind: `repo-local-mixed-terminal-and-promotion-frontier`
- Diagnostics ready subset count: `2`
- Ready subset: `spec.traffic-alb-controller.ingress-routing`, `spec.traffic-alb-controller.upgrade-survival`
- Current exact preserved frontier: cleanup-only authority gap for `spec.traffic-alb-controller.enable-lifecycle`
- Command surface if ever rerun later: `bun run execute features/traffic-alb-controller/compact/staging.plan.json --parallel=50`
- Current truthful decision: exact cleanup-only wait preserved; no rerun.

## Why no rerun was queued

This task is fix-forward and explicitly forbids rerunning the same input after the same error without changed input, changed diagnosis, or a new external fact. This retry produced none of those for a bounded execution candidate. The only truthful work item was:

1. correct the stale/fresh evidence guard,
2. correct the three `frontierTaskIds` writebacks,
3. align the evidence wording with the actual state-vs-diagnostics contract.

No local live-admission checks were run because no Azure DevOps or GitHub live dispatch was proposed or queued in this retry.

## Verification summary

- Diagnostics still advertise non-empty ready subsets for all five sampled features: counts `1 / 1 / 34 / 6 / 2`.
- App-owned state now preserves exact holder `frontierTaskIds` for all five sampled features without broadening to a family placeholder.
- App-owned state now points all five sampled features at this current-attempt evidence path and refreshed `updatedAt` / `lastCheckedAt` timestamps.
- App-owned state still has zero non-null instances of `compactLiveReadiness`, `compactSelectionCoverage`, `selectionBlocker`, `packageStatus`, and `liveDispatchGate`, so this memo treats those as diagnostics-only surfaces.

## Planner/reviewer follow-up implication

No new tree change is emitted from this worker. If the planner wants a follow-up, it should keep the existing exact waits as the live representation and should **not** create a broad rerun from this retry alone.

## FIX_FORWARD_RESULT

```json
{
  "workflow": "fix-forward",
  "subject": {
    "kind": "feature-family",
    "id": "package-partial"
  },
  "classification": "other-known-class",
  "diagnosis": "This retry corrected fix-forward evidence/state drift rather than AKS product behavior: the previous memo incorrectly claimed diagnostics-derived compact readiness/selection/gate structures were written into controller-visible state, and it incorrectly claimed frontierTaskIds had already been normalized for machines-agentpool, net-integration, and traffic-alb-controller. Current app-owned state now truthfully preserves the exact holder arrays and points at a fresh current-attempt evidence memo, while compactLiveReadiness/compactSelectionCoverage/selectionBlocker/packageStatus/liveDispatchGate remain diagnostics-only surfaces.",
  "evidenceFreshness": "fresh-attempt-path",
  "minimumDiagnosisPacket": {
    "target": "staging",
    "branch": "dev",
    "runId": "",
    "resultPath": "evidence/archive/reconcile-compact-loop-package-partial-attempt-a_reconcile-compact-loop-package-partial_20260715081726-20260715T082230Z-worker.md",
    "failingPhase": "compact-state-reconciliation",
    "failingAssertion": "controller-visible sampled package-partial rows must preserve exact holders, use a fresh current-attempt evidence path, and not claim diagnostics-only readiness/gate structures as persisted state fields",
    "requestOrResponseExcerpt": "Previous evidence claimed frontierTaskIds had been normalized and compact readiness/gate structures were written into state, but current readback before this retry still showed frontierTaskIds=[] for three rows and zero non-null state instances of those diagnostics-only fields.",
    "referencesChecked": [
      "model/knowledge-map/README.md",
      "workspace/task-publish-kms-repair/publish/replays/execution/automation.md",
      "/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json",
      "features/egress-lockdown/compact/staging.diagnostics.json",
      "features/machines-agentpool/compact/staging.diagnostics.json",
      "features/net-integration/compact/staging.diagnostics.json",
      "features/rp-nodepool-lifecycle/compact/staging.diagnostics.json",
      "features/traffic-alb-controller/compact/staging.diagnostics.json",
      "/app/projects/aks-rp-e2e.app/evidence/archive/reconcile-compact-loop-package-partial-attempt-20260715T081432Z-worker.md"
    ],
    "inputFingerprint": "All five task-context input fingerprints remain unchanged against the current sampled state/diagnostics pairing.",
    "errorFingerprint": "egress=unchanged exact wait; machines=unchanged same-spec preflight blocker; net=unchanged exact environment-registration frontier; rp=current state already reflects the narrowed single rollback frontier; traffic=unchanged cleanup-only authority gap.",
    "evidenceFreshness": "fresh-attempt-path"
  },
  "changedFiles": [
    "/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json",
    "/app/projects/aks-rp-e2e.app/evidence/archive/reconcile-compact-loop-package-partial-attempt-a_reconcile-compact-loop-package-partial_20260715081726-20260715T082230Z-worker.md"
  ],
  "verification": {
    "runId": "",
    "resultPath": "evidence/archive/reconcile-compact-loop-package-partial-attempt-a_reconcile-compact-loop-package-partial_20260715081726-20260715T082230Z-worker.md",
    "status": "pass",
    "evidenceFreshness": "fresh-attempt-path"
  },
  "nextAction": "exact-wait",
  "nextActionReason": "No sampled feature gained changed input, changed same-surface diagnosis, or a new external fact that would justify a bounded rerun. The smallest truthful post-repair move is to preserve the current exact holders and wait on their already-documented resume conditions."
}
```