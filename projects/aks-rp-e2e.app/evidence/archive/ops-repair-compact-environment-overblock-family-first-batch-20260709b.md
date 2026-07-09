# Compact environment-overblock family first-batch review (2026-07-09)

- Task: `ops-repair-compact-environment-overblock-family-first-batch-20260709b`
- Attempt: `a_ops-repair-compact-environment-overblock-family-first-batch-20260709b_20260709073838`
- Mode: Task Worker Mode
- Runtime tree mutation from this worker: none
- Output purpose: planner/app-ops apply memo for one truthful family reduction

## Decision

The **largest truthful shared-cause slice** in the current compact warning cluster is the existing **reviewed-exception / compact live-ready filter family** already carried by:

- `wait-compact-reviewed-exception-live-ready-policy-family-20260702`

This is the right family to keep as one shared blocked representation. Several current `hold-compact-*-package-partial-frontier` leaves still look like separate environment-overblock waits, but their real blocker is the same narrower cause:

- all selected specs are already in the compact package,
- local check mode passes,
- the remaining blocked members are intentionally quarantined because `reviewed-exception` is non-live-ready under the current compact eligibility policy,
- and the truthful next move is **accepted member reclassification or a human-approved live-ready policy change**, not another unchanged compact rerun.

So this batch should collapse to **one exact shared family wait**, not many passive feature-level environment waits.

## Sources reviewed

- `/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json`
- `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`
- `/app/projects/aks-rp-e2e/features/ccp-coredns/compact/staging.summary.md`
- `/app/projects/aks-rp-e2e/features/ossku-migration/compact/staging.summary.md`
- `/app/projects/aks-rp-e2e/features/planned-maintenance/compact/staging.summary.md`
- Prior accepted family notes:
  - `/app/projects/aks-rp-e2e/evidence/archive/ops-repair-compact-environment-overblock-family-20260709.md`
  - `/app/projects/aks-rp-e2e.app/evidence/archive/ops-audit-compact-environment-overblock-warning-family-20260709.md`
  - `/app/projects/aks-rp-e2e.app/evidence/archive/ops-repair-compact-environment-overblock-family-second-batch-20260709.md`

## Chosen family

### Shared family carrier

- `wait-compact-reviewed-exception-live-ready-policy-family-20260702`

### Why this is the largest truthful shared slice

Its current tree goal already says it represents the shared residual reviewed-exception/live-ready policy wait for:

- `ccp-coredns`
- the reviewed-exception siblings of `machines-agentpool`
- `planned-maintenance`
- `ossku-migration`

Its blocker contract is already explicit and exact:

- blocked only while those reviewed-exception members remain intentionally excluded from the compact live-ready subset,
- resume only on accepted reviewed-exception member reclassification or a human-approved compact live-ready policy change,
- keep the separate same-spec `machines-agentpool` run-review wait outside this shared family.

That is already a smaller and more truthful family wait than the duplicate feature-level passive holders.

## Baseline contributor set before this review

Ignoring this task itself, the currently visible first-batch duplicate holders in app runtime state are:

- `hold-compact-ccp-coredns-package-partial-frontier`
- `hold-compact-ossku-migration-package-partial-frontier`
- `hold-compact-planned-maintenance-package-partial-frontier-202607090638`

And the shared family already in tree is:

- `wait-compact-reviewed-exception-live-ready-policy-family-20260702`

The family wait also already names the reviewed-exception siblings of `machines-agentpool`, while explicitly excluding the separate exact same-spec cleanup rerun-review wait.

## Proof that these holders share one cause

### 1) `ccp-coredns`

`features/ccp-coredns/compact/staging.summary.md` says:

- all 6/6 specs are selected into the compact package,
- 2 members remain quarantined only for live dispatch,
- exact blocker kind is `repo-local-live-ready-filter`,
- reason: `compactEligibility()` treats `reviewed-exception` as non-live-ready,
- resume only if those specs are reclassified or the live-ready filter intentionally changes.

The current task-tree holder says the same thing: the package remains partial only because `spec.ccp-coredns.pdb-disruption-budget` and `spec.ccp-coredns.upgrade-survival` remain reviewed-exception members intentionally quarantined by the live-ready filter.

### 2) `ossku-migration`

`features/ossku-migration/compact/staging.summary.md` says:

- all 9/9 active specs are selected into the package,
- 3 members remain quarantined only for live dispatch,
- exact blocker kind is `repo-local-live-ready-filter`,
- the remaining blocked members are reviewed-exception carriers,
- resume only on accepted reclassification or intentional filter broadening.

The current task-tree holder already says to reuse `wait-compact-reviewed-exception-live-ready-policy-family-20260702` for the remaining Mariner-era reviewed-exception member set.

### 3) `planned-maintenance`

`features/planned-maintenance/compact/staging.summary.md` says:

- all 7/7 active specs are selected into the package,
- 2 members remain quarantined only for live dispatch,
- exact blocker kind is `repo-local-live-ready-filter`,
- both remaining members are reviewed-exception carriers,
- resume only on accepted reclassification or intentional filter broadening.

The current task-tree holder likewise says the only remaining blocker is the residual reviewed-exception pair under the shared live-ready filter wait.

## Why some nearby holders are **not** part of this shared slice

This review intentionally does **not** merge all package-partial warnings together.

### `machines-agentpool`

Current feature state and current holder text preserve one exact same-spec review frontier for:

- `wait-compact-machines-agentpool-run-28809049156-review-20260707`

So only the reviewed-exception siblings belong to the shared family wait. The exact single-spec cleanup rerun-review branch does not.

### `node-http-proxy`

This is not a shared reviewed-exception family wait. Its remaining blocker is the exact trusted-ca carrier / owner-decision branch:

- `wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708`

### `trusted-access`

This is not a live-ready-filter family wait. Its remaining blocker is the accepted DNS NXDOMAIN runtime frontier for `westus2.ta.azmk8s.io`, not generic compact policy.

These exclusions matter because they prove the chosen family is truthful rather than overly broad.

## Post-review represented set the planner should preserve

### Keep as the single shared family representation

- `wait-compact-reviewed-exception-live-ready-policy-family-20260702`

### Replace / retire as duplicate passive compact holders for this exact slice

- `hold-compact-ccp-coredns-package-partial-frontier`
- `hold-compact-ossku-migration-package-partial-frontier`
- `hold-compact-planned-maintenance-package-partial-frontier-202607090638`

### Keep separate exact blockers outside this shared family

- `wait-compact-machines-agentpool-run-28809049156-review-20260707`
- `wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708`
- `hold-compact-trusted-access-ta-gateway-dns-runtime-frontier-20260705` or the equivalent trusted-access exact runtime frontier

## Exact next owner action and check window

The next owner action is **not** another unchanged compact rerun.

The next owner action is:

1. **Planner/app-ops apply step**
   - treat `wait-compact-reviewed-exception-live-ready-policy-family-20260702` as the sole shared carrier for this first-batch slice,
   - replace or retire the duplicate passive feature-level holders listed above from warning-family presentation,
   - keep the separate exact `machines-agentpool` same-spec review frontier outside this family.

2. **Human/domain resume trigger already defined by the shared wait**
   - accepted evidence reclassifies the reviewed-exception members, **or**
   - a human-approved compact live-ready policy change broadens the carrier family.

3. **Current review/check window already defined by the shared wait**
   - `next_check_at = 2026-07-09T18:00:00Z`
   - `fallback_at = 2026-07-10T18:00:00Z`
   - fallback action: create or reuse one exact owner recovery/escalation task, or refresh the blocked wait with new evidence instead of letting duplicate passive holders linger overdue.

## Net result

For this first batch, the truthful reduction is:

- **one shared compact-side family wait** for the reviewed-exception live-ready-filter slice,
- **three duplicate package-partial holders replaced** in planner presentation,
- and **nearby nonshared exact blockers kept separate**.

That is a real warning-family reduction because it replaces several passive environment-looking leaves with one exact existing owner/check surface instead of inventing another broad umbrella wait.
