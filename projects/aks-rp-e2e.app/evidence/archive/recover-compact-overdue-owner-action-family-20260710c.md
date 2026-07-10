# recover-compact-overdue-owner-action-family-20260710c

- Task: `ops/recover-compact-overdue-owner-action-family-20260710c`
- Attempt: `a_ops_recover-compact-overdue-owner-action-family-20260710c_20260710043602`
- Reviewed at: `2026-07-10T11:43:09Z`
- Mode: Task Worker Mode / planner-review output only unless the task explicitly names bounded task-tree commands
- Runtime tree mutation from this worker: none

## Result

I audited the seven overdue compact owner-action holders named by the task against the app-owned runtime authorities:

- `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`
- `/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json`
- maintained compact summaries in `/app/projects/aks-rp-e2e/features/*/compact/staging.summary.md`

Per worker-mode rules, I treated this audit task itself as absent from the baseline and did **not** reshape the tree. This memo gives the planner/app-ops apply packet needed to restore one truthful recovery/escalation path per family.

## Pre-audit contributor set

Excluding this audit task itself, the overdue compact owner-action family is currently represented by these seven compact holders in the runtime tree, each with expired compact-local `next_check_at` / `fallback_at` windows:

1. `hold-compact-paf-throttling-reviewed-exception-frontier`
2. `hold-compact-rp-cluster-lifecycle-package-partial-frontier`
3. `hold-compact-rp-nodepool-lifecycle-package-partial-frontier`
4. `hold-compact-secops-package-partial-frontier`
5. `hold-compact-serverless-package-partial-frontier`
6. `hold-compact-sgx-addon-vm-prerelease-matrix-reviewed-exception-frontier`
7. `hold-compact-storage-csi-package-partial-frontier`

The shared problem is not that all seven need reruns. The real problem is that these compact-facing holders have drifted into overdue owner-action residue while their truthful next steps now differ:

- some are still the exact family holder and only need refreshed watch/evidence metadata,
- some are already covered by sharper downstream waits,
- some need a real active owner-review / escalation slice instead of a passive blocked compact holder,
- and some should be replaced by a sharper exact compact residual family holder that already exists elsewhere in the tree.

## Classification summary

| family | current holder | classification | truthful next process move |
|---|---|---|---|
| paf-throttling | `hold-compact-paf-throttling-reviewed-exception-frontier` | **needs refreshed evidence/watch metadata** | keep the same exact holder, refresh watch windows and evidence anchor |
| rp-cluster-lifecycle | `hold-compact-rp-cluster-lifecycle-package-partial-frontier` | **needs owner/escalation send-handoff** | add one active/review owner-promotion frontier task for the execute-ready carriers; keep preserved outside-branch waits separate |
| rp-nodepool-lifecycle | `hold-compact-rp-nodepool-lifecycle-package-partial-frontier` | **needs owner/escalation send-handoff** | add one active/review owner-promotion frontier task for the four execute-ready carriers; keep rollback environment wait separate |
| secops | `hold-compact-secops-package-partial-frontier` | **exact downstream wait already covers it** | keep downstream exact waits as governing frontier; refresh compact-local carrier wording/watch only if needed |
| serverless | `hold-compact-serverless-package-partial-frontier` | **needs sharper replacement family task** | replace passive compact owner-action hold with one exact active/review promotion frontier task while preserving the existing exact runtime/input waits |
| sgx-addon-vm-prerelease-matrix | `hold-compact-sgx-addon-vm-prerelease-matrix-reviewed-exception-frontier` | **exact downstream wait already covers it** | keep `wait-spec-sgx-addon-vm-prerelease-matrix-owner-live-carrier-decision-20260703` as the governing wait and refresh/retie the compact alias to it |
| storage-csi | `hold-compact-storage-csi-package-partial-frontier` | **needs sharper replacement family task** | replace the stale broad package-partial holder with the already-sharper residual compact holder `hold-compact-storage-csi-successor-pair-and-residual-frontier-20260707` |

## Family-by-family evidence and judgment

### 1) paf-throttling

### Current live truth

`hold-compact-paf-throttling-reviewed-exception-frontier` is still a truthful exact family holder:

- blocker says compact check already passes,
- remaining blocker is a reviewed-exception pipeline-only environment boundary,
- no exact downstream spec/shared wait currently replaces it,
- runtime compact state still points to this same holder id.

But its runtime watch fields are stale:

- `next_check_at = 2026-07-09T04:42:33.486Z`
- `fallback_at = 2026-07-10T04:12:33.486Z`

### Classification

**Needs refreshed evidence/watch metadata.**

### Planner/app-ops apply meaning

- keep `hold-compact-paf-throttling-reviewed-exception-frontier` as the single truthful family holder,
- refresh blocker evidence wording from the current compact artifacts,
- roll `next_check_at` / `resume_at` / `fallback_at` forward,
- do **not** invent a duplicate rerun or shared wait unless a sharper returned surface actually appears.

---

### 2) rp-cluster-lifecycle

### Current live truth

`hold-compact-rp-cluster-lifecycle-package-partial-frontier` is stale as a passive owner-action hold.

Its blocker already says the compact frontier is an owner-review split:

- eight execute-ready promotion candidates,
- one check-only live-authoring gap (`spec.rp-cluster-lifecycle.new-vnet-lifecycle-vm-prerelease`),
- two preserved outside-branch waits (`new-vnet-runner-variant`, `nodeless-cluster-crud`).

Runtime compact state also classifies it as:

- `rootCauseClassification = repo-local-mixed-terminal-and-promotion-frontier`
- `nextStepClassification = owner review of the exact rp-cluster-lifecycle split frontier`

The runtime tree only shows one preserved exact downstream wait among the named residue here:

- `hold-spec-rp-cluster-lifecycle-new-vnet-runner-variant-pipeline-only-reviewed-exception-20260707`

That means the compact holder is no longer just a passive wait; it needs visible owner-review coverage for the eight execute-ready candidates.

Its compact-local watch fields are stale:

- `next_check_at = 2026-07-09T04:42:34.116Z`
- `fallback_at = 2026-07-10T04:12:34.116Z`

### Classification

**Needs owner/escalation send-handoff.**

### Planner/app-ops apply meaning

Create one exact active/review owner-promotion task, for example:

- `domain/review-rp-cluster-lifecycle-promotion-frontier-20260710`

Exact scope of that task should be:

- review/promotion decision for the eight execute-ready carriers only,
- keep `spec.rp-cluster-lifecycle.new-vnet-lifecycle-vm-prerelease` as separate live-authoring-gap residue,
- keep `hold-spec-rp-cluster-lifecycle-new-vnet-runner-variant-pipeline-only-reviewed-exception-20260707` and the nodeless-cluster wait outside this branch,
- do not reopen a broad compact rerun.

If planner chooses not to add the active review task, then the compact holder at minimum must be refreshed to say it is awaiting that exact owner action rather than lingering as an expired passive hold.

---

### 3) rp-nodepool-lifecycle

### Current live truth

`hold-compact-rp-nodepool-lifecycle-package-partial-frontier` is the same shape as rp-cluster-lifecycle, but smaller:

- four execute-ready promotion candidates,
- one separate exact rollback environment wait: `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707`.

Runtime compact state classifies it as:

- `rootCauseClassification = repo-local-mixed-terminal-and-promotion-frontier`
- `nextStepClassification = owner promotion review for the four execute-ready nodepool carriers while preserving the rollback environment wait`

Its compact-local watch fields are stale:

- `next_check_at = 2026-07-09T04:42:34.271Z`
- `fallback_at = 2026-07-10T04:12:34.271Z`

### Classification

**Needs owner/escalation send-handoff.**

### Planner/app-ops apply meaning

Create one exact active/review owner-promotion task, for example:

- `domain/review-rp-nodepool-lifecycle-promotion-frontier-20260710`

Exact scope of that task should be:

- owner-promotion / reclassification review for `add-remove`, `multi-agentpool-runner`, `scale-manual`, and `upgrade-nodeimage`,
- preserve `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` as the separate rollback environment frontier,
- do not reopen a broad compact rerun.

If planner chooses not to add the active review task, the compact holder must at least be refreshed to describe that same owner-action handoff explicitly.

---

### 4) secops

### Current live truth

`hold-compact-secops-package-partial-frontier` is already covered by sharper downstream waits/frontiers.

Runtime compact state shows the feature already depends on these exact downstream ids:

- `hold-spec-secops-fips-exact-13spec-mixed-frontier-20260708`
- `wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702`
- `wait-secops-identity-same-run-artifact-review-family-20260704`
- `wait-secops-identity-sp-workflow-secret-contract-return-20260704`
- `wait-spec-secops-fips-slice1-create-timeout-family-return-20260708`
- `wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708`

The blocker text is also exact: the truthful next step is review of already-queued run `28732370985` for the two SP-backed identity specs, while the passive FIPS/check-only members stay preserved by the exact waits above.

Its compact-local watch fields are stale:

- `next_check_at = 2026-07-09T04:42:34.425Z`
- `fallback_at = 2026-07-10T04:12:34.425Z`

But unlike serverless or storage-csi, there is no missing sharper governing wait. The sharper waits already exist.

### Classification

**Exact downstream wait already covers it.**

### Planner/app-ops apply meaning

- keep the downstream exact secops waits as the governing frontier,
- refresh the compact-local holder wording/watch metadata only if planner wants the compact alias to remain visible,
- do **not** create a duplicate compact-local recovery branch.

---

### 5) serverless

### Current live truth

`hold-compact-serverless-package-partial-frontier` is stale and no longer a sufficient owner-action family holder.

Runtime compact state shows the feature now depends on these exact frontier ids:

- `hold-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260708`
- `hold-spec-serverless-virtualnodes-standard-extension-install-reviewed-frontier-20260707c`
- `wait-serverless-virtual-nodes-shared-subnet-authorization-family-20260703`
- `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
- `wait-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260707f`
- `wait-spec-serverless-virtual-nodes-runtime-readiness-family-20260708`

The compact summary also says the six excluded members are all execute-ready promotion candidates:

- `spec.serverless-virtual-nodes.addonv2-aci-connector`
- `spec.serverless-virtual-nodes.addonv2-aci-connector-mounted-vmss-lifecycle`
- `spec.serverless-virtual-nodes.dns-resolution.external-from-aci`
- `spec.serverless-virtual-nodes.multi-pod-burst`
- `spec.serverless-virtual-nodes.virtual-node-addon`
- `spec.serverless-virtualnodes.standard`

The holder blocker text refers to an active follow-up for the standard extension-install frontier, but the referenced domain task is **missing** from the runtime tree; only the exact blocked frontier remains present. That is the clearest signal that the current compact owner-action family has lost active review coverage.

Its compact-local watch fields are stale:

- `next_check_at = 2026-07-09T04:53:03.067Z`
- `fallback_at = 2026-07-10T04:23:03.067Z`

### Classification

**Needs sharper replacement family task.**

### Planner/app-ops apply meaning

The passive compact holder should be replaced or subordinated to one exact active/review promotion frontier task, for example:

- `domain/review-serverless-virtualnodes-promotion-frontier-20260710`

Exact scope of that task should be:

- own the promotion/reclassification decision for the six execute-ready serverless candidates,
- preserve the exact runtime/input waits already present (`runtime-readiness`, `subnet-authorization`, `standard-extension-install`, `underlay-kubeconfig` / shared-underlay waits),
- repair the stale reference to the missing serverless extension-install follow-up by either creating the exact review task or removing the claim that it already exists,
- do not reopen a generic broad serverless compact rerun.

This is one of the three watchdog-flagged families that still lacks visible active/review recovery coverage.

---

### 6) sgx-addon-vm-prerelease-matrix

### Current live truth

`hold-compact-sgx-addon-vm-prerelease-matrix-reviewed-exception-frontier` is already represented by an exact downstream wait:

- `wait-spec-sgx-addon-vm-prerelease-matrix-owner-live-carrier-decision-20260703`

That wait is healthy and already has future owner-review windows:

- `next_check_at = 2026-07-10T18:00:00Z`
- `fallback_at = 2026-07-11T18:00:00Z`

The compact holder blocker text already says the exact represented blocker is that same wait, and runtime compact state also lists:

- `frontierTaskIds = ['wait-spec-sgx-addon-vm-prerelease-matrix-owner-live-carrier-decision-20260703']`

The only stale part is the compact alias itself:

- `next_check_at = 2026-07-09T04:53:03.727Z`
- `fallback_at = 2026-07-10T04:23:03.727Z`

### Classification

**Exact downstream wait already covers it.**

### Planner/app-ops apply meaning

- keep `wait-spec-sgx-addon-vm-prerelease-matrix-owner-live-carrier-decision-20260703` as the governing family wait,
- refresh or rebind the compact alias so watchdog/frontier coverage sees that the compact holder is subordinate to that exact wait,
- do **not** create a duplicate SGX compact-local owner wait.

This is one of the three watchdog-flagged families, but unlike serverless it already has the sharper exact wait in-tree; the repair is representational alignment, not new domain work.

---

### 7) storage-csi

### Current live truth

`hold-compact-storage-csi-package-partial-frontier` is stale because a sharper exact compact family holder already exists:

- `hold-compact-storage-csi-successor-pair-and-residual-frontier-20260707`

That sharper holder already truthfully captures the current residual frontier after accepted successor proof for `disk-xfs` and `disk-resize`, and it has future watch windows:

- `next_check_at = 2026-07-10T12:00:00Z`
- `fallback_at = 2026-07-10T18:00:00Z`

Runtime compact state for `storage-csi` also says the only remaining residual member waits are:

- `hold-spec-storage-csi-csidrivers-source-only-frontier-20260708`
- `hold-spec-storage-csi-file-nfs-unmount-boundary-source-scaffold-frontier-20260708`
- `wait-storage-csi-mcr-mirror-monitor-direct-registry-access-20260702`

The stale broad compact holder has expired watch fields:

- `next_check_at = 2026-07-09T04:53:04.142Z`
- `fallback_at = 2026-07-10T04:23:04.142Z`

### Classification

**Needs sharper replacement family task.**

### Planner/app-ops apply meaning

- replace `hold-compact-storage-csi-package-partial-frontier` as the compact-facing governing family holder with the already-sharper `hold-compact-storage-csi-successor-pair-and-residual-frontier-20260707`,
- keep the three exact residual member waits unchanged,
- update compact-loop state/task binding so the runtime-visible compact family points at the sharper residual holder,
- do **not** reopen the superseded broad five-member compact blocker.

This is one of the three watchdog-flagged families, and unlike SGX its repair is to swap in the sharper exact compact residual holder that already exists.

## Post-action represented set the planner should realize

If planner/app-ops applies the narrowest truthful repair, the post-action represented set should be:

1. `hold-compact-paf-throttling-reviewed-exception-frontier`
   - refreshed exact compact family holder
2. `domain/review-rp-cluster-lifecycle-promotion-frontier-20260710`
   - new active/review owner-promotion slice for rp-cluster-lifecycle
3. `domain/review-rp-nodepool-lifecycle-promotion-frontier-20260710`
   - new active/review owner-promotion slice for rp-nodepool-lifecycle
4. `hold-compact-secops-package-partial-frontier`
   - optional refreshed compact alias only; actual governance remains the downstream secops waits already present
5. `domain/review-serverless-virtualnodes-promotion-frontier-20260710`
   - new active/review owner-promotion slice for serverless while preserving exact runtime/input waits
6. `wait-spec-sgx-addon-vm-prerelease-matrix-owner-live-carrier-decision-20260703`
   - governing SGX wait, with compact alias refreshed/subordinated to it
7. `hold-compact-storage-csi-successor-pair-and-residual-frontier-20260707`
   - governing compact storage-csi residual holder, replacing the stale broad package-partial alias

## Minimal planner/app-ops apply packet

### Refresh-only

- refresh `hold-compact-paf-throttling-reviewed-exception-frontier`
- refresh/subordinate `hold-compact-sgx-addon-vm-prerelease-matrix-reviewed-exception-frontier`
- optionally refresh compact alias wording/watch on `hold-compact-secops-package-partial-frontier`

### Add active/review owner-action work

- add `domain/review-rp-cluster-lifecycle-promotion-frontier-20260710`
- add `domain/review-rp-nodepool-lifecycle-promotion-frontier-20260710`
- add `domain/review-serverless-virtualnodes-promotion-frontier-20260710`

### Replace stale broad compact holders with sharper represented frontiers

- for SGX: bind compact coverage explicitly to `wait-spec-sgx-addon-vm-prerelease-matrix-owner-live-carrier-decision-20260703`
- for storage-csi: replace `hold-compact-storage-csi-package-partial-frontier` with `hold-compact-storage-csi-successor-pair-and-residual-frontier-20260707`
- for secops: keep the existing downstream exact waits/frontiers as the governing coverage

## Acceptance-specific reconciliation

### All seven classified

Yes. Each of the seven holders is classified into one of the requested buckets in the summary table above.

### Three watchdog-flagged holders lacking recovery coverage

Planner/app-ops should treat these three distinctly:

- **serverless**: add one active/review promotion frontier task; current passive holder is not enough
- **sgx-addon-vm-prerelease-matrix**: retain the already-existing exact wait and refresh compact alias linkage so coverage is visible
- **storage-csi**: swap to the already-existing sharper residual compact holder and keep the three member waits

### Memo showing truthful blocked representations vs refreshed/replaced/escalated families

- **remain truthful blocked representations with refresh only**: paf-throttling, secops compact alias, sgx compact alias/subordinate wait
- **need refreshed owner-action send-handoff / active review**: rp-cluster-lifecycle, rp-nodepool-lifecycle, serverless
- **need sharper replacement carrier**: storage-csi

## Bottom line

The seven-family overdue compact owner-action problem is not one bug.

It splits into:

- one exact holder that just needs metadata refresh (`paf-throttling`),
- two compact owner-review frontiers that need a real active send-handoff (`rp-cluster-lifecycle`, `rp-nodepool-lifecycle`),
- one compact alias already covered by exact downstream waits (`secops`),
- one stale broad compact frontier that now needs a sharper active review replacement (`serverless`),
- one compact alias already truthfully governed by a sharper shared wait (`sgx-addon-vm-prerelease-matrix`),
- and one stale broad compact frontier that should be replaced by a sharper compact residual holder already in the tree (`storage-csi`).

That is the smallest truthful planner/app-ops apply surface that clears the fallback-expired compact owner-action residue without reopening blind reruns.
