# Compact environment-overblock family first wave (2026-07-09)

- Task: `ops-repair-compact-environment-overblock-family-first-wave-20260709`
- Attempt: `a_ops-repair-compact-environment-overblock-family-first-wave-20260709_20260709084445`
- Mode: Task Worker Mode
- Runtime tree mutation from this worker: none
- Output purpose: planner/app-ops review material for one bounded family reduction

## Executive verdict

The highest-value truthful reduction still available in the compact environment-overblock warning family is the existing **reviewed-exception / compact live-ready policy** carrier:

- `wait-compact-reviewed-exception-live-ready-policy-family-20260702`

The remaining duplicate passive compact holders that should collapse into that one shared wait are:

- `hold-compact-ossku-migration-package-partial-frontier-202607090751`
- `hold-compact-planned-maintenance-package-partial-frontier-202607090751`

`machines-agentpool` is **adjacent but not collapsible** in the same way, because its current feature-level meaning is the separate exact same-spec preflight-blocked review branch for run `28809049156`, not just the residual reviewed-exception family. `ccp-coredns` is also part of the same compact policy family in maintained feature authority, but it is already no longer projected as an active duplicate compact holder in current app state.

So the truthful first-wave action is:

1. keep `wait-compact-reviewed-exception-live-ready-policy-family-20260702` as the single family wait,
2. remove/rebind the duplicate passive compact holders for `ossku-migration` and `planned-maintenance` from warning-family presentation,
3. leave `machines-agentpool` on its separate exact same-spec branch.

## Sources reviewed

- `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`
- `/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json`
- `/app/projects/aks-rp-e2e/features/ccp-coredns/compact/staging.summary.md`
- `/app/projects/aks-rp-e2e/features/ossku-migration/compact/staging.summary.md`
- `/app/projects/aks-rp-e2e/features/planned-maintenance/compact/staging.summary.md`
- `/app/projects/aks-rp-e2e/features/machines-agentpool/compact/staging.summary.md`
- `/app/projects/aks-rp-e2e.app/evidence/archive/ops-repair-compact-environment-overblock-family-first-batch-20260709b.md`
- `/app/projects/aks-rp-e2e.app/evidence/archive/ops-audit-compact-environment-overblock-warning-family-20260709.md`

## Baseline contributor set before this first wave

Computed as if this worker task did not exist.

### Shared family carrier already present

- `wait-compact-reviewed-exception-live-ready-policy-family-20260702`

### Still-visible duplicate passive compact holders in that same family slice

- `hold-compact-ossku-migration-package-partial-frontier-202607090751`
- `hold-compact-planned-maintenance-package-partial-frontier-202607090751`

### Adjacent holder that must stay separate

- `hold-compact-machines-agentpool-package-partial-frontier-202607090638`

### Supporting note

`ccp-coredns` still matches the same maintained reviewed-exception/live-ready-policy shape, but current compact loop state already shows `taskId: null` instead of another active duplicate compact holder. That means this family has already been partially reduced, and the remaining first-wave cleanup opportunity is concentrated in `ossku-migration` and `planned-maintenance`.

## Why this family is the best next collapse candidate

This family already has a truthful shared blocked carrier with exact scope, owner, resume condition, next check, and fallback. The duplicate feature-level holders add noise without adding distinct process meaning.

The shared carrier says it represents:

- `ccp-coredns`
- the reviewed-exception siblings of `machines-agentpool`
- `planned-maintenance`
- `ossku-migration`

And it already preserves the important exclusion:

- keep the separate exact same-spec `machines-agentpool` run-review wait outside this family.

That makes it a better first-wave reduction than inventing a new umbrella environment wait.

## Proof that `ossku-migration` belongs on the shared family wait

Current compact loop state for `ossku-migration` says:

- `taskId = hold-compact-ossku-migration-package-partial-frontier-202607090751`
- `rootCauseClassification = repo-local-live-ready-filter`
- `retryReason` explicitly says to reuse `wait-compact-reviewed-exception-live-ready-policy-family-20260702`
- `frontierTaskIds = [hold-spec-loop-pending-ossku-migration-owner-family-20260704]`

Maintained compact summary says:

- all 9/9 active specs are selected into the compact package,
- only 3 members remain quarantined for live dispatch,
- exact blocker kind is `repo-local-live-ready-filter`,
- the remaining uncovered members are reviewed-exception carriers,
- resume condition is reclassification or intentional live-ready policy broadening.

So the feature-level passive holder is not adding a different owner action. The real family meaning is already captured by the shared wait.

## Proof that `planned-maintenance` belongs on the shared family wait

Current compact loop state for `planned-maintenance` says:

- `taskId = hold-compact-planned-maintenance-package-partial-frontier-202607090751`
- `rootCauseClassification = repo-local-live-ready-filter`
- `nextStepClassification = reviewed-exception live-ready policy or residual reclassification`
- `resumeCondition` is accepted reclassification of the two reviewed-exception members or intentional live-ready policy broadening

Maintained compact summary says:

- all 7/7 active specs are selected into the compact package,
- only 2 members remain quarantined for live dispatch,
- exact blocker kind is `repo-local-live-ready-filter`,
- both remaining uncovered members are reviewed-exception carriers,
- resume condition is reclassification or intentional live-ready policy broadening.

Again, the feature-level passive holder is duplicating the family-level policy wait rather than preserving distinct meaning.

## Why `machines-agentpool` must stay outside this collapse

Current compact loop state for `machines-agentpool` says:

- `taskId = hold-compact-machines-agentpool-package-partial-frontier-202607090638`
- `nextStepClassification` is the exact same-spec preflight-blocked rerun result from run `28809049156`
- `waitingCondition` says do not rerun unchanged because run `28809049156` already proved the current reference/validator/request-shape blocker before Azure resource changes
- `resumeCondition` is a bounded repo-local fix or accepted reclassification of that exact same-spec blocker

Maintained compact summary separately says the feature also contains reviewed-exception members under the broader live-ready filter. But the current feature-level task pointer is **not** just carrying that broader family policy wait; it is carrying a sharper exact same-spec review branch.

So collapsing `machines-agentpool` into the shared family wait would lose exact meaning.

## Why this is more truthful than a generic environment umbrella

This first wave avoids a false merge.

The surviving shared cause is not generic "environment overblock." It is specifically:

- all relevant specs are already selected into compact packages,
- local check mode passes,
- remaining blocked members are intentionally quarantined because `reviewed-exception` is non-live-ready under the current compact policy,
- and the next truthful move is accepted reclassification or a human-approved policy change.

That exact cause is already encoded by `wait-compact-reviewed-exception-live-ready-policy-family-20260702`.

## Exact planner/app-ops action to apply

### Keep as the sole family carrier

- `wait-compact-reviewed-exception-live-ready-policy-family-20260702`

Preserved blocked contract already in tree:

- owner: `aks-explorer`
- condition: blocked only while the residual reviewed-exception members remain intentionally excluded from the compact live-ready subset
- resume condition: accepted reclassification of those members or a human-approved compact live-ready policy change
- next check / fallback: already maintained on the existing wait

### Replace / retire as duplicate passive holders in warning-family presentation

- `hold-compact-ossku-migration-package-partial-frontier-202607090751`
- `hold-compact-planned-maintenance-package-partial-frontier-202607090751`

### Keep separate exact blocker outside this family

- `hold-compact-machines-agentpool-package-partial-frontier-202607090638`
  - because it currently carries the exact same-spec preflight-blocked review meaning for run `28809049156`, not just the residual reviewed-exception family

## Post-action represented set

If planner applies this first wave, the family should read as:

### One shared wait

- `wait-compact-reviewed-exception-live-ready-policy-family-20260702`
  - carrying the reviewed-exception/live-ready-policy family for `ccp-coredns`, `ossku-migration`, `planned-maintenance`, and only the reviewed-exception siblings of `machines-agentpool`

### Separate exact nonfamily hold that remains visible

- `hold-compact-machines-agentpool-package-partial-frontier-202607090638`
  - until the exact same-spec preflight blocker from run `28809049156` changes materially

## Net result

This first wave removes the clearest remaining duplicate passive compact holders from one already-defined family without inventing a new umbrella wait and without flattening distinct exact blockers.

The compact blocked frontier becomes more readable because:

- `ossku-migration` and `planned-maintenance` stop pretending to be separate passive family waits,
- the existing shared family wait becomes the single truthful owner/check surface for that slice,
- and `machines-agentpool` stays separate where its exact same-spec preflight blocker still matters.

## Worker-mode note

I did not mutate the runtime task tree from this session. Under Task Worker Mode, this file is planner/app-ops review material naming the exact family collapse the planner should apply.