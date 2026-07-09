# Compact reviewed-exception environment-overblock audit — batch 2 (2026-07-09k)

- Task: `ops/audit-compact-reviewed-exception-environment-overblock-batch2-20260709k`
- Attempt: `a_ops_audit-compact-reviewed-exception-environment-overblock-batch2-20260709113729`
- Mode: Task Worker Mode
- Runtime tree mutation from this worker: bounded `task-tree update-text` on existing task `hold-compact-sgx-addon-vm-prerelease-matrix-reviewed-exception-frontier`
- Output purpose: audit record plus proof of one bounded compact warning-family repair

## Executive result

I audited the requested second reviewed-exception warning batch:

- `hold-compact-sgx-addon-vm-prerelease-matrix-reviewed-exception-frontier`
- `hold-compact-defender-profile-reviewed-exception-frontier`
- `hold-compact-ccp-agent-reviewed-exception-frontier`
- `hold-compact-upgrade-reviewed-exception-frontier`

Result:

- I repaired **one** passive environment-looking holder in place:
  - repaired holder: `hold-compact-sgx-addon-vm-prerelease-matrix-reviewed-exception-frontier`
  - exact represented wait it now points to: `wait-spec-sgx-addon-vm-prerelease-matrix-owner-live-carrier-decision-20260703`
- I confirmed the remaining three sampled holders are **not all the same problem**:
  - `defender-profile` is primarily an owner promotion / eligibility frontier, not environment setup.
  - `ccp-agent` is a mixed promotion + one exact reviewed-exception migration frontier, not one shared environment wait.
  - `upgrade` still looks environment-like, but the holder cites `wait-compact-upgrade-underlay-control-plane-prereqs-20260703` and that exact wait id is **missing** from the live tree, so this one is not a safe no-text represented-wait rebind from this session.

## Sources reviewed

- App runtime tree: `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`
- App planning packet via `bun run task-tree packet`
- Warning heuristic: `/app/projects/aks-rp-e2e.app/workflows/lib/task-tree-tools.ts`
- Compact summaries:
  - `/app/projects/aks-rp-e2e/features/sgx-addon-vm-prerelease-matrix/compact/staging.summary.md`
  - `/app/projects/aks-rp-e2e/features/defender-profile/compact/staging.summary.md`
  - `/app/projects/aks-rp-e2e/features/ccp-agent/compact/staging.summary.md`
  - `/app/projects/aks-rp-e2e/features/upgrade/compact/staging.summary.md`
- Existing exact waits / related holders in live tree:
  - `wait-spec-sgx-addon-vm-prerelease-matrix-owner-live-carrier-decision-20260703`
  - `wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708`
  - `hold-compact-ccp-agent-reviewed-exception-frontier`
  - `hold-compact-defender-profile-reviewed-exception-frontier`
  - `hold-compact-upgrade-reviewed-exception-frontier`

## Live pre-action baseline

Using the live planning packet before mutation, the sampled compact warning holders all appeared in `blocked_action_warnings` as `environment-overblock` items:

- `hold-compact-ccp-agent-reviewed-exception-frontier`
- `hold-compact-defender-profile-reviewed-exception-frontier`
- `hold-compact-sgx-addon-vm-prerelease-matrix-reviewed-exception-frontier`
- `hold-compact-upgrade-reviewed-exception-frontier`

Pre-action warning count from the live packet slice:

- `blocked_action_warnings_count = 24`

## Why the SGX holder was repairable now

### 1) The compact summary already says the frontier is an owner-decision boundary

`features/sgx-addon-vm-prerelease-matrix/compact/staging.summary.md` says:

- the exact blocker kind is `check-only-live-authoring-gap-on-source-grounded-sgx-carrier`
- local check mode already passes
- no truthful live rerun exists until one exact SGX row gains owner-approved live carrier authoring or the source-grounded carrier is intentionally reclassified
- the exact next holder is already named as `wait-spec-sgx-addon-vm-prerelease-matrix-owner-live-carrier-decision-20260703`

So the SGX holder was not truthfully an environment setup wait. It was already an owner-decision frontier described in compact evidence.

### 2) The exact represented wait already exists live

The live tree contains:

- `wait-spec-sgx-addon-vm-prerelease-matrix-owner-live-carrier-decision-20260703`

That wait is already:

- `external-wait`
- `blocker.owner = human`
- an explicit owner decision about whether to keep the SGX carrier nonlive or approve one exact SGX row as a truthful live-capable carrier

### 3) The warning heuristic suppresses represented or human-owned exact waits

`workflows/lib/task-tree-tools.ts` currently suppresses `environment-overblock` warnings when a blocked holder is either:

- a human-owned `external-wait`; or
- a represented blocked frontier with text like `represented by`, `split-frontier`, and `exact represented blocker`

That meant the SGX holder could be repaired with a bounded text rewrite and owner normalization, without creating new tasks or reopening any rerun.

## Repair performed

I ran one bounded existing-task metadata repair:

- command family used: `task-tree update-text`
- task id changed: `hold-compact-sgx-addon-vm-prerelease-matrix-reviewed-exception-frontier`

### Updated goal

The holder now states that it exists only as a represented split-frontier carrier while the exact represented blocker remains:

- `wait-spec-sgx-addon-vm-prerelease-matrix-owner-live-carrier-decision-20260703`

### Updated acceptance

The holder now explicitly says:

1. it remains blocked only while that exact wait still controls the same SGX row 57/58/59 frontier;
2. no duplicate environment setup, diagnosis, or rerun work should be created from the compact holder; and
3. compact work resumes only after that represented frontier materially changes or is replaced with sharper owner-approved live-carrier evidence.

### Updated blocker text

The blocker condition now begins with:

- `Represented by wait-spec-sgx-addon-vm-prerelease-matrix-owner-live-carrier-decision-20260703.`
- `This compact leaf is a split-frontier carrier for feature-local state only...`

It now explicitly preserves the same exact boundary:

- source-grounded / check-only SGX carrier remains intentional
- local check mode is already green
- no accepted row-exact live execution surface exists yet
- no truthful rerun exists until the exact owner decision changes

I also changed the compact holder blocker owner to `human`, aligning it with the exact represented wait.

## Post-action packet result

Using the live planning packet after the repair:

- `blocked_action_warnings_count = 23`
- `hold-compact-sgx-addon-vm-prerelease-matrix-reviewed-exception-frontier` no longer appears in the warning list
- the other sampled holders still appear:
  - `hold-compact-ccp-agent-reviewed-exception-frontier`
  - `hold-compact-defender-profile-reviewed-exception-frontier`
  - `hold-compact-upgrade-reviewed-exception-frontier`

So this worker completed one real compact warning-family reduction without reopening unchanged reruns.

## Judgment for the other sampled holders

## 1) `defender-profile`

Current live holder:

- `hold-compact-defender-profile-reviewed-exception-frontier`

Current compact summary truth:

- the only compact member is `spec.defender-profile.vm-prerelease-matrix`
- the repo already has bounded request-plus-runtime floor evidence
- compact check already passes
- the remaining blocker is owner promotion / compact-eligibility reclassification
- the summary already says no new bounded rerun is justified

### Judgment

This warning looks **stale/noisy in classification**, because the real frontier is owner promotion / eligibility review, not environment setup.

But unlike SGX, there is no live exact human-owned represented wait id already carrying the same boundary. The holder currently points to accepted note evidence (`evidence/archive/review-compact-defender-profile-promotion-frontier-20260704.md`) rather than one exact live wait task.

### Planner/app-ops follow-up implied by this audit

If planner wants to remove this warning cleanly, it should either:

1. rewrite this holder into an explicit represented promotion frontier with sharper owner wording and represented-carrier text, or
2. create/restore one exact owner-promotion wait and then bind the compact holder to that exact wait.

## 2) `ccp-agent`

Current live holder:

- `hold-compact-ccp-agent-reviewed-exception-frontier`

Current compact summary truth:

- three members are execute-ready promotion candidates:
  - `spec.ccp-agent.connectivity-tunnel`
  - `spec.ccp-agent.lifecycle-deployment`
  - `spec.ccp.connected-cluster-proxy-auth`
- one member remains the reviewed-exception migration blocker:
  - `spec.ccp.tunnelfront-konnectivity-migration`
- the exact spec-level owner-response wait already exists for that migration branch:
  - `wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708`

### Judgment

This is **not** one environment wait. It is a **mixed frontier**:

- owner promotion / reclassification for three execute-ready source-grounded carriers, plus
- one exact human-owned lineage-excerpt owner-response wait for the migration carrier

So this holder should not be collapsed into one generic environment blocker. But it also is not yet a clean one-to-one represented wait like SGX.

### Planner/app-ops follow-up implied by this audit

Planner should rewrite `hold-compact-ccp-agent-reviewed-exception-frontier` as an explicit mixed compact frontier that names:

- the three execute-ready promotion candidates, and
- `wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708`

That would remove the misleading environment-style presentation without pretending the whole feature is governed by one single exact wait.

## 3) `upgrade`

Current live holder:

- `hold-compact-upgrade-reviewed-exception-frontier`

Current compact summary truth:

- `spec.upgrade.vm-prerelease-blocking-pdb` passed
- `spec.upgrade.vm-prerelease-max-unavailable` passed
- only `spec.upgrade.vm-prerelease-deprecated-api-detection` remains blocked
- the remaining blocker is exact prerequisite supply:
  - `AKS_RP_E2E_UNDERLAY_KUBECONFIG`
  - `AKS_RP_E2E_CONTROL_PLANE_ID`

The compact holder text says the exact surviving holder is:

- `wait-compact-upgrade-underlay-control-plane-prereqs-20260703`

But when I checked the live tree, that exact task id is **missing**.

### Judgment

This warning is **not stale**. The compact holder is still carrying a real exact prerequisite boundary, but it references an exact wait id that is no longer present in the live tree.

That means this session could not truthfully convert it into a represented exact wait without either:

1. restoring/recreating the missing exact wait, or
2. intentionally rewriting the compact holder onto a different exact live carrier with a matching owner/resume contract.

### Planner/app-ops follow-up implied by this audit

Planner should either:

- recreate/restore `wait-compact-upgrade-underlay-control-plane-prereqs-20260703`, then bind the compact holder to it; or
- rewrite the compact frontier contract so the exact underlay/control-plane prerequisite boundary is represented explicitly without dangling a missing wait id.

## Pre-action contributor set

For this audit, the truthful pre-action contributor set was:

- `hold-compact-ccp-agent-reviewed-exception-frontier`
- `hold-compact-defender-profile-reviewed-exception-frontier`
- `hold-compact-sgx-addon-vm-prerelease-matrix-reviewed-exception-frontier`
- `hold-compact-upgrade-reviewed-exception-frontier`

## Post-action represented set

After the SGX repair, the more truthful represented set for this sampled family is:

- `wait-spec-sgx-addon-vm-prerelease-matrix-owner-live-carrier-decision-20260703`
- `hold-compact-defender-profile-reviewed-exception-frontier` (still needs promotion-frontier rewrite or exact owner wait)
- `hold-compact-ccp-agent-reviewed-exception-frontier` (still needs mixed-frontier rewrite)
- `hold-compact-upgrade-reviewed-exception-frontier` (still needs missing exact wait restoration or contract rewrite)

## Net effect

This worker reduced the sampled compact reviewed-exception `environment-overblock` batch by one real item:

- before: 4 sampled holders all appeared as `environment-overblock`
- after: the SGX holder is explicitly represented by its exact human-owned owner-decision wait and no longer appears in the warning list

That leaves the batch in a sharper state:

- **SGX** -> exact represented owner-decision wait
- **defender-profile** -> promotion / eligibility frontier, warning likely stale in category but not yet rebound to one exact wait
- **ccp-agent** -> explicit mixed frontier case, not one environment wait
- **upgrade** -> exact prerequisite frontier, but its cited exact wait is missing and needs planner repair

## Worker-mode note

I did not create, reassign, or reshape tasks beyond the bounded existing-task metadata repair allowed by Task Worker Mode. The memo above is planner/app-ops review material for any further compact warning-family cleanup.