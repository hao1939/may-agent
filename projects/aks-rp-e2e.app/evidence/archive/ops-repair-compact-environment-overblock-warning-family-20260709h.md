# Compact environment-overblock warning family repair note (2026-07-09h)

- Task: `ops/repair-compact-environment-overblock-warning-family-20260709h`
- Attempt: `a_ops_repair-compact-environment-overblock-warning-family-20260709h_20260709112957`
- Mode: Task Worker Mode
- Runtime tree mutation from this worker: bounded `task-tree update-text` on existing task `hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier`
- Output purpose: audit record plus proof of one bounded tree repair inside the compact `blocked_action_warnings` family

## Executive result

I audited the current compact `environment-overblock` warning family against the live task tree and repaired one misleading duplicate holder:

- repaired holder: `hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier`
- exact represented wait it now points to: `wait-ccp-security-patch-reviewed-exception-owner-response-20260708`

This repair changed the compact holder from a passive environment-looking blocker into an explicitly **represented split-frontier carrier** whose exact blocker is the human-owned owner/source-authority wait already present in the tree.

## Live pre-repair baseline

From the live planner packet before the repair:

- `blocked_action_warnings_count = 25`
- the warning list included `hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier`
- the warning kind for that holder was `environment-overblock`

The current warning family also included nearby reviewed-exception compact holders such as:

- `hold-compact-ccp-agent-reviewed-exception-frontier`
- `hold-compact-ccp-vpa-os-arch-variants-reviewed-exception-frontier`
- `hold-compact-defender-profile-reviewed-exception-frontier`
- `hold-compact-extension-addon-reviewed-exception-frontier`
- `hold-compact-hcp-interceptor-reviewed-exception-frontier`
- `hold-compact-paf-throttling-reviewed-exception-frontier`
- `hold-compact-sgx-addon-vm-prerelease-matrix-reviewed-exception-frontier`
- `hold-compact-upgrade-reviewed-exception-frontier`
- `hold-compact-virtualmachine-prerelease-row60-legacy-addon-disable-scaling-reviewed-exception-frontier`

## Evidence that the ccp-security-patch holder was misleading

### 1) The compact holder already described an exact surviving owner-decision wait

Before repair, `hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier` contained blocker text that said:

- `Do not regenerate a generic compact-error repair leaf.`
- `Exact surviving holder is wait-ccp-security-patch-reviewed-exception-owner-decision-20260703`
- the next truthful step is owner/source-authority reclassification of the MarinerV2 carrier

So even before mutation, the live compact holder was not really asking for environment setup. It was describing an exact reviewed-exception owner-decision wait.

### 2) The live tree already had a fresher exact owner-response wait for the same family

The live tree contains:

- `wait-ccp-security-patch-reviewed-exception-owner-response-20260708`

That wait is already a human-owned `external-wait` with an explicit resume contract covering:

- `spec.ccp-security-patch.mariner-v2-prod-mtc`
- `spec.ccp-security-patch.windows2022-prod-mtc`
- `spec.ccp-security-patch.windows2025-prod-mtc`

Its blocker states that no unchanged rerun is truthful before the returned owner/source-authority decision arrives.

### 3) The warning heuristic suppresses represented and human-owned exact waits

The current warning logic in `workflows/lib/task-tree-tools.ts` suppresses `environment-overblock` warnings when a blocked task is either:

- a human-owned `external-wait`; or
- a represented blocked frontier (`split-frontier`, `represented by`, `exact represented blocker`, etc.)

That meant this holder could be repaired in place by making the representation explicit, without creating new tasks or reshaping the tree.

## Repair performed

I ran one bounded existing-task metadata repair on the flagged holder:

- command family used: `task-tree update-text`
- task id changed: `hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier`

### Updated goal

The holder now says it exists only as a represented split-frontier carrier while the exact represented blocker remains:

- `wait-ccp-security-patch-reviewed-exception-owner-response-20260708`

### Updated acceptance

The holder now explicitly says:

1. it remains blocked only while that exact wait still controls the same reviewed-exception frontier;
2. no duplicate environment setup, diagnosis, or rerun work should be created from this compact holder; and
3. compact work resumes only after that represented frontier materially changes or is replaced with sharper evidence.

### Updated blocker text

The blocker condition now begins with:

- `Represented by wait-ccp-security-patch-reviewed-exception-owner-response-20260708.`
- `This compact leaf is a split-frontier carrier for feature-local state only ...`

and names the same exact remaining family:

- MarinerV2 InvalidOSSKU evidence remains
- Windows2022/Windows2025 still lack source-authorized carriers
- no duplicate environment setup or unchanged rerun is truthful unless the represented frontier materially changes

I also set the compact holder blocker owner to `human`, which aligns it with the exact owner-response wait it now represents.

## Live post-repair result

From the live planner packet after the repair:

- total `blocked_action_warnings_count = 25`
- compact-family warning count is now `24`
- `hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier` no longer appears in `blocked_action_warnings`
- the remaining non-compact warning in the packet is `wait-dev-infra-core-runtime-speedup-proof-run-171538136-result-20260709`

So this task completed one real compact-family cleanup even though the overall packet still contains one unrelated non-compact warning:

- before: the compact warning family included the misleading reviewed-exception holder `hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier`
- after: that same holder is represented as a split-frontier carrier for the exact human-owned owner-response wait, and it disappeared from the compact warning family

## Classification judgment for adjacent holders

These remain in the warning family after the one bounded repair and should be treated as later follow-up candidates, not part of this task's direct mutation set:

- `hold-compact-sgx-addon-vm-prerelease-matrix-reviewed-exception-frontier`
  - likely similar duplicate/noise because it already cites exact wait `wait-spec-sgx-addon-vm-prerelease-matrix-owner-live-carrier-decision-20260703`
- `hold-compact-defender-profile-reviewed-exception-frontier`
  - likely heuristic noise rather than wrong blocker, because it is really an owner-promotion/reclassification frontier, not environment setup

## Pre-action contributor set

For this audit, the truthful pre-action contributor set included at least these compact warning holders:

- `hold-compact-ccp-agent-reviewed-exception-frontier`
- `hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier`
- `hold-compact-ccp-vpa-os-arch-variants-reviewed-exception-frontier`
- `hold-compact-defender-profile-reviewed-exception-frontier`
- `hold-compact-extension-addon-reviewed-exception-frontier`
- `hold-compact-hcp-interceptor-reviewed-exception-frontier`
- `hold-compact-paf-throttling-reviewed-exception-frontier`
- `hold-compact-sgx-addon-vm-prerelease-matrix-reviewed-exception-frontier`
- `hold-compact-upgrade-reviewed-exception-frontier`
- `hold-compact-virtualmachine-prerelease-row60-legacy-addon-disable-scaling-reviewed-exception-frontier`

## Post-action represented set

After the repair, the family is represented more truthfully because:

- `hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier` is no longer a passive environment-looking blocker
- the exact family-level wait remains `wait-ccp-security-patch-reviewed-exception-owner-response-20260708`
- the warning family shrank by one item

## Net result

The compact `environment-overblock` warning family was partly stale. At least one flagged holder was misleading, and this worker repaired it directly in the live tree:

- repaired: `hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier`
- represented by: `wait-ccp-security-patch-reviewed-exception-owner-response-20260708`
- measurable effect: the compact warning family dropped from `25` compact holders to `24` compact holders in the planner packet slice, that task id disappeared from the warning list, and the only remaining extra warning in the full packet is unrelated non-compact task `wait-dev-infra-core-runtime-speedup-proof-run-171538136-result-20260709`
