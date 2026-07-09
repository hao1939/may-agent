# Compact environment-overblock family review — batch d (2026-07-09)

- Task: `ops-repair-compact-environment-overblock-family-20260709d`
- Attempt: `a_ops-repair-compact-environment-overblock-family-20260709d_20260709103418`
- Mode: worker evidence / planner guidance only
- Runtime task-tree mutation from this session: none

## Scope reviewed

Current compact blocked leaves in app runtime state:

- `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`
- `/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json`

Prior accepted repair guidance already applied or partially applied:

- `evidence/archive/ops-repair-compact-environment-overblock-shared-family-20260709c.md`
- `evidence/archive/ops-repair-compact-environment-overblock-family-20260709.md`
- `evidence/archive/ops-consolidate-compact-environment-overblock-family-20260709b.md`
- `evidence/archive/ops-burn-down-remaining-compact-environment-overblock-family-20260709.md`

## Executive conclusion

The current compact warning-heavy family is **already much smaller than the stale family evidence suggests**.

As of the current runtime snapshot, the highest-noise compact environment-overblock members fall into four buckets:

1. **Already reduced to one truthful shared wait**
   - app-monitoring on westus2 managed-cluster capacity
   - planned-maintenance / ossku-migration / ccp-coredns reviewed-exception slice on the shared live-ready policy wait
2. **Already reduced to one truthful compact-facing exact carrier**
   - serverless-schedulerctrl underlay/runtime-input projection
   - app-routing VM-prerelease environment quartet
   - cluster-autoscaler VM-prerelease environment heptet
3. **Already repaired out of generic compact environment-holder shape**
   - gpu generic holder is now `done/replaced`
   - cluster-autoscaler generic package-partial holder is now `done/replaced`
4. **Residual feature-level mixed/split frontiers that should stay separate**
   - app-routing non-environment residue
   - aad-rbac mixed residual trio
   - net-integration mixed environment/terminal/promotion frontier
   - kms-etcd-encryption residual split frontier
   - private-cluster mixed frontier
   - machines-agentpool exact same-spec review frontier
   - secops same-run review frontier

So the current useful owner action is **not** another broad consolidation wave. The useful owner action is a **state/backbinding cleanup** so controller-visible feature state points at the exact waits already present in runtime.

## Baseline contributor set (excluding this audit task)

Computed from current `.state/tasks/tree.json` plus `.state/feature-compact-loop/state.json`.

### A. Truthfully shared waits that should survive unchanged

#### 1. Westus2 managed-cluster capacity family

Surviving wait:
- `wait-shared-westus2-managed-cluster-capacity-family-return-20260703`

Current compact member:
- `app-monitoring.taskId = wait-shared-westus2-managed-cluster-capacity-family-return-20260703`

Judgment:
- already correct
- do not recreate any compact-local duplicate environment holder for app-monitoring

#### 2. Shared reviewed-exception / compact live-ready policy family

Surviving wait:
- `wait-compact-reviewed-exception-live-ready-policy-family-20260702`

Current runtime goal explicitly says it covers:
- `ccp-coredns`
- reviewed-exception siblings of `machines-agentpool`
- `planned-maintenance`
- `ossku-migration`

Judgment:
- already correct as the one truthful shared cause
- do not recreate feature-local generic environment/package-partial holders for planned-maintenance or ossku-migration
- ccp-coredns may remain feature-adjacent, but there is no missing shared family work here

#### 3. Shared underlay/runtime-input family

Surviving project-level wait:
- `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`

Current compact-facing exact projection:
- `hold-compact-serverless-schedulerctrl-live-workflow-frontier`

Judgment:
- already correct
- this is no longer a generic publish/auth or environment-parking holder
- keep the compact-facing projection separate from unrelated capacity or policy families

## B. Exact compact-facing carriers already created by earlier repairs

#### 1. app-routing environment quartet

Surviving exact compact-facing wait:
- `wait-compact-app-routing-vm-prerelease-environment-quartet-return-20260709`

Separate non-environment residual holder:
- `hold-compact-app-routing-package-partial-frontier-202607090657`

Judgment:
- do not merge app-routing back into one environment-overblock family
- the split is now truthful:
  - one exact environment quartet carrier
  - one exact non-environment residue holder

#### 2. cluster-autoscaler environment heptet

Surviving exact compact-facing wait:
- `wait-compact-cluster-autoscaler-vm-prerelease-environment-heptet-return-20260709`

Replaced generic holder:
- `hold-compact-cluster-autoscaler-package-partial-frontier-202607090657`
  - `state: done`
  - `resolution: replaced`

Judgment:
- earlier repair already did the right replacement
- do not reopen the broad package-partial environment holder

#### 3. gpu generic holder

Replaced generic holder:
- `hold-compact-gpu-package-partial-frontier`
  - `state: done`
  - `resolution: replaced`

Accepted replacement meaning in runtime review note:
- `wait-spec-gpu-classic-westus2-sku-support-family-return-20260704`
- `wait-spec-network-cni-cilium-enterprise-addon-underlay-kubeconfig-response-20260630`

Judgment:
- earlier repair already proved gpu does **not** have one shared cause
- keep the two exact shared waits separate

## C. Residual leaves that should remain separate

These are still exact mixed/split frontiers rather than one real shared environment cause.

### Keep separate as feature-level residual holders

- `hold-compact-app-routing-package-partial-frontier-202607090657`
  - now only the non-environment residue
- `hold-compact-aad-rbac-package-partial-frontier`
  - residual trio with different member-level reopen surfaces
- `hold-compact-net-integration-package-partial-frontier`
  - mixed environment / terminal / promotion frontier
- `hold-compact-kms-etcd-encryption-package-partial-frontier-202607090800`
  - shared invalid-SKU/provider wait plus residual split frontier
- `hold-compact-private-cluster-package-partial-frontier-202607090641-ownerfix`
  - mixed frontier with queued exact same-spec review plus preserved nonlive rows
- `hold-compact-machines-agentpool-package-partial-frontier-202607090638`
  - effectively a same-spec run-review frontier, not a family environment wait
- `hold-compact-secops-package-partial-frontier`
  - exact same-run review frontier, not a broad environment family

### Why they must remain separate

Because each one still carries one of these shapes:

- mixed environment + product-gap + reviewed-exception
- same-run review of one exact carrier
- mixed terminal + promotion + environment frontier
- exact shared wait plus residual feature split

None of those is truthfully reducible to one new common owner/setup/escalation family.

## Current state drift found

The biggest remaining problem is now **projection drift**, not missing family classification.

### Feature-state taskId pointers that are stale or missing

From current `.state/feature-compact-loop/state.json`:

| feature | current state pointer | runtime truth | judgment |
|---|---|---|---|
| `gpu` | `hold-compact-gpu-package-partial-frontier` | holder already `done/replaced` | stale pointer |
| `cluster-autoscaler` | `hold-compact-cluster-autoscaler-package-partial-frontier-202607090657` | holder already `done/replaced`; exact successor is `wait-compact-cluster-autoscaler-vm-prerelease-environment-heptet-return-20260709` | stale pointer |
| `planned-maintenance` | `null` | exact shared wait exists: `wait-compact-reviewed-exception-live-ready-policy-family-20260702` | missing pointer |
| `ccp-coredns` | `null` | exact shared wait exists: `wait-compact-reviewed-exception-live-ready-policy-family-20260702` | missing pointer |
| `ossku-migration` | `hold-compact-ossku-migration-package-partial-frontier` | no blocked runtime holder with that id; shared wait exists instead | stale pointer |

## What the planner/app-ops owner should do next

### 1. Do not open another generic compact environment-overblock family task for these same leaves

The family classification work is already mostly done in runtime state.

### 2. Apply a compact-state backbinding / reprojection sweep

Minimum worthwhile repairs:

- `gpu`
  - stop pointing feature state at `hold-compact-gpu-package-partial-frontier`
  - preserve the accepted two-cause split already named in runtime review
- `cluster-autoscaler`
  - move feature state from replaced `hold-compact-cluster-autoscaler-package-partial-frontier-202607090657`
  - to `wait-compact-cluster-autoscaler-vm-prerelease-environment-heptet-return-20260709`
- `planned-maintenance`
  - bind feature state to `wait-compact-reviewed-exception-live-ready-policy-family-20260702`
- `ccp-coredns`
  - bind feature state to `wait-compact-reviewed-exception-live-ready-policy-family-20260702`
- `ossku-migration`
  - replace stale missing holder id with `wait-compact-reviewed-exception-live-ready-policy-family-20260702`

### 3. Keep these exact shared causes unchanged

- `wait-shared-westus2-managed-cluster-capacity-family-return-20260703`
- `wait-compact-reviewed-exception-live-ready-policy-family-20260702`
- `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
- `wait-compact-app-routing-vm-prerelease-environment-quartet-return-20260709`
- `wait-compact-cluster-autoscaler-vm-prerelease-environment-heptet-return-20260709`

### 4. Keep these residual holders separate

- `hold-compact-app-routing-package-partial-frontier-202607090657`
- `hold-compact-aad-rbac-package-partial-frontier`
- `hold-compact-net-integration-package-partial-frontier`
- `hold-compact-kms-etcd-encryption-package-partial-frontier-202607090800`
- `hold-compact-private-cluster-package-partial-frontier-202607090641-ownerfix`
- `hold-compact-machines-agentpool-package-partial-frontier-202607090638`
- `hold-compact-secops-package-partial-frontier`
- `hold-compact-serverless-schedulerctrl-live-workflow-frontier`

## Why this is the smallest truthful result now

Because the current runtime tree already answers most of the family question:

- **shared causes** are already shared
- **replaced generic holders** are already replaced
- **mixed frontiers** are already split away from the shared-cause family

The remaining noise is that feature-compact state still points at old or missing holders, which makes the family look less repaired than the runtime blocked tree actually is.

## Bottom line

For the current compact warning-heavy family:

- **keep** westus2 capacity as one exact shared wait
- **keep** the reviewed-exception live-ready policy as one exact shared wait
- **keep** the shared underlay/runtime-input family plus the serverless-schedulerctrl compact-facing projection
- **keep** app-routing and other mixed frontiers separate
- **do not** reopen replaced gpu or cluster-autoscaler generic holders
- **next owner action is projection/backbinding cleanup**, not another broad environment-family consolidation pass
