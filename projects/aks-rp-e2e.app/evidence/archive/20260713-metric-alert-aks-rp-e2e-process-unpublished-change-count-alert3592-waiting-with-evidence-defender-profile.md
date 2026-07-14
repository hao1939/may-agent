# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 3592)

Operation: `waiting_with_evidence`
Date: 2026-07-13
Owner: `app-ops`
Metric current: `5`
Threshold/target: `0`

## Judgment

The breach is real right now, but it is no longer anonymous repo residue. It is one coherent 5-file `defender-profile` promotion slice in `/app/projects/aks-rp-e2e` that app-ops should not publish or revert unilaterally because the remaining decision is AKS domain correctness.

## Current measured repo truth

Direct recompute from the metric source still returns `value: 5`.

Current tracked unpublished files:

1. `features/defender-profile/compact/staging.diagnostics.json`
2. `features/defender-profile/compact/staging.plan.json`
3. `features/defender-profile/compact/staging.summary.md`
4. `features/defender-profile/specs/defender-profile-vm-prerelease-matrix.json`
5. `features/defender-profile/tests/defender-profile-vm-prerelease-matrix.ts`

There is no ahead count in the repo header during this sample, so the breach is the dirty tracked file slice itself.

## Why this is one coherent domain slice

The spec/test/compact diffs all move the same carrier from blocked draft posture to ready/source-grounded live-dispatch posture:

- `features/defender-profile/specs/defender-profile-vm-prerelease-matrix.json`
  - `status: draft -> ready`
  - semantic closure promoted to `request-plus-runtime-floor-accepted-ready-source-grounded-carrier`
- `features/defender-profile/tests/defender-profile-vm-prerelease-matrix.ts`
  - check-mode evidence now reports `ready-source-grounded-carrier-maintained`
- compact plan/diagnostics/summary
  - package status `blocked -> ready`
  - live dispatch `allowed: false -> true`
  - excluded/quarantined member set collapses to empty

Repo-local validation for the same slice passes:

- `bun features/defender-profile/tests/defender-profile-vm-prerelease-matrix.ts --check`
  - `status: pass`
  - summary says the mounted source, spec, and probe agree on a `ready/source-grounded` live-capable carrier.
- `bun test features/defender-profile/tests/defender-profile-vm-prerelease-matrix.test.ts`
  - project test passes for this carrier.

## Exact wait

- Waiting for: `aks-explorer` to decide the domain publication boundary for the 5-file `defender-profile` ready-promotion slice.
- Owner of wait: `aks-explorer`
- Observer: `app-ops`
- Observation method: recompute `aks-rp-e2e.process.unpublished-change-count` and inspect `git status --porcelain=v1 --branch` in `/app/projects/aks-rp-e2e`.
- Resume condition:
  - either publish this exact 5-file slice as a truthful checkpoint, or
  - revert it and regenerate the compact outputs back to the prior accepted state.
- Fallback: if no domain action lands and the same 5-file slice still breaches on the next metrics refresh window, escalate to planner/May as a missing domain-owner publication decision rather than treating it as anonymous repo hygiene.
- Affected scope: `defender-profile` compact/spec/test carrier only.

## Why not `fix_root_cause`

The remaining move is not an app orchestration repair. The repo state and local checks say the change is coherent, but deciding whether the project should publish the `ready/source-grounded` promotion is AKS domain judgment. App-ops can narrow and hold the wait exactly, but should not publish or revert the domain slice on its own.
