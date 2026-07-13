# 2026-07-13 Fleet compact lineage holder integrity review

## Scope

Review whether the current live Fleet compact holder and its spec-loop bridge still truthfully reuse controller-visible downstream holders, specifically:

1. compact holder `hold-compact-fleet-reviewed-exception-split-frontier-20260709`
2. same-path hubless contract holder `hold-spec-fleet-hubless-rpapi-version-progression-contract-frontier-20260708`
3. VM prerelease lineage holder `hold-spec-fleet-vm-prerelease-rpapi-auto-upgrade-matrix-lineage-only-frontier-20260707`
4. controller-visible spec-loop bridge `hold-spec-loop-pending-fleet-vm-prerelease-umbrella-nonlive-20260705b`

## Live reads used

- `bun run task-tree show hold-compact-fleet-reviewed-exception-split-frontier-20260709`
- `bun run task-tree show hold-spec-fleet-hubless-rpapi-version-progression-contract-frontier-20260708`
- `bun run task-tree show hold-spec-fleet-vm-prerelease-rpapi-auto-upgrade-matrix-lineage-only-frontier-20260707`
- `.state/feature-compact-loop/state.json`
- `.state/spec-loop/state.json`
- `features/fleet/compact/staging.summary.md`

## Findings

### 1) The compact-facing Fleet holder is live and already points at the exact downstream lineage

Live task-tree output for `hold-compact-fleet-reviewed-exception-split-frontier-20260709` shows:

- state: `blocked`
- current acceptance explicitly binds:
  - `spec.fleet.hubless-rpapi-lifecycle` -> `hold-spec-fleet-hubless-rpapi-version-progression-contract-frontier-20260708`
  - `spec.fleet.vm-prerelease-rpapi-auto-upgrade-matrix` -> `hold-spec-fleet-vm-prerelease-rpapi-auto-upgrade-matrix-lineage-only-frontier-20260707`
- the same acceptance also preserves the controller-visible VM prerelease bridge through `hold-spec-loop-pending-fleet-vm-prerelease-umbrella-nonlive-20260705b`
- blocker text says to keep this exact compact holder visible and not reopen a broad Fleet rerun or recreate a generic lineage-repair task

So the compact-facing holder is present, current, and already expresses the intended downstream reuse.

### 2) The hubless contract holder is live and still truthful

Live task-tree output for `hold-spec-fleet-hubless-rpapi-version-progression-contract-frontier-20260708` shows:

- state: `blocked`
- goal remains the exact same-path Fleet update-readback/version-progression contract frontier for `spec.fleet.hubless-rpapi-lifecycle`
- blocker text revalidates the same governing evidence: compact precursor run `28621132999` and exact reviewed verifier run `171368699`
- the current wait still says no bounded repo-local repair or unchanged rerun is truthful until an authoritative contract/product decision or materially different same-path evidence appears

This is still the exact downstream holder the compact Fleet branch should reuse for the hubless member.

### 3) The VM prerelease lineage holder is live and still truthfully depends on the spec-loop bridge

Live task-tree output for `hold-spec-fleet-vm-prerelease-rpapi-auto-upgrade-matrix-lineage-only-frontier-20260707` shows:

- state: `blocked`
- goal preserves the exact reviewed-exception lineage-only/nonlive frontier for `spec.fleet.vm-prerelease-rpapi-auto-upgrade-matrix`
- acceptance explicitly says mounted-source evidence keeps the spec nonlive and the controller-visible spec-loop bridge is preserved through `hold-spec-loop-pending-fleet-vm-prerelease-umbrella-nonlive-20260705b`
- blocker text says the compact Fleet state should keep reusing this exact downstream frontier without reopening an unchanged rerun

So the VM prerelease holder is present and still depends on the exact bridge named by the task.

### 4) The spec-loop bridge is still controller-visible

Current `.state/spec-loop/state.json` shows for `spec.fleet.vm-prerelease-rpapi-auto-upgrade-matrix`:

- `taskId = hold-spec-loop-pending-fleet-vm-prerelease-umbrella-nonlive-20260705b`
- `lastAction` says to keep pending/nonlive under that bridge and not rerun the unchanged umbrella

That confirms the bridge is still the controller-visible spec-loop carrier.

### 5) The compact loop still points at the current Fleet holder, not a stale predecessor

Current `.state/feature-compact-loop/state.json` shows for `fleet`:

- `taskId = hold-compact-fleet-reviewed-exception-split-frontier-20260709`
- blocked reason still names the exact downstream waits:
  - `hold-spec-fleet-hubless-rpapi-version-progression-contract-frontier-20260708`
  - `hold-spec-fleet-vm-prerelease-rpapi-auto-upgrade-matrix-lineage-only-frontier-20260707`

This means the controller-visible compact loop is aligned to the current reviewed-exception split holder, not to the older broad/stale Fleet compact holder id.

### 6) The compact summary still matches the live holder membership

`features/fleet/compact/staging.summary.md` still records the reviewed-exception frontier as exactly:

- `spec.fleet.hubless-rpapi-lifecycle`
- `spec.fleet.vm-prerelease-rpapi-auto-upgrade-matrix`

That matches the live compact holder's represented membership.

## Verdict

All referenced Fleet lineage pieces are present and truthful in the current live tree/state:

- keep `hold-compact-fleet-reviewed-exception-split-frontier-20260709`
- keep `hold-spec-fleet-hubless-rpapi-version-progression-contract-frontier-20260708`
- keep `hold-spec-fleet-vm-prerelease-rpapi-auto-upgrade-matrix-lineage-only-frontier-20260707`
- keep `hold-spec-loop-pending-fleet-vm-prerelease-umbrella-nonlive-20260705b`

No referenced holder or bridge is stale or missing, so no supported task-tree mutation is needed from this worker pass.

## Exact next Fleet process state

Preserve the existing Fleet compact holder unchanged.

The truthful current lineage is:

- `hold-compact-fleet-reviewed-exception-split-frontier-20260709`
  - reuses `hold-spec-fleet-hubless-rpapi-version-progression-contract-frontier-20260708`
  - reuses `hold-spec-fleet-vm-prerelease-rpapi-auto-upgrade-matrix-lineage-only-frontier-20260707`
    - which in turn preserves controller-visible spec-loop state through `hold-spec-loop-pending-fleet-vm-prerelease-umbrella-nonlive-20260705b`

Do not reopen broad Fleet reruns.
Do not disturb `hold-spec-fleet-hubless-rpapi-version-progression-contract-frontier-20260708`.
Do not create a replacement holder from this review.

## Worker action taken

- Wrote this audit memo only.
- Executed no task-tree mutation commands because the live holder/bridge lineage is already exact.