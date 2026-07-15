# 2026-07-14 no-executable-work-with-gaps repair

## Scope and worker boundary

This worker investigated the current task-tree starvation condition for `ops/repair-no-executable-work-with-gaps-20260714` using the current app task-tree packet plus controller-visible spec-loop, compact-loop, and model-path signals.

Per worker-mode constraints, I did **not** mutate the runtime tree, emit events, or create new tasks directly. This note records the factual diagnosis and the exact planner-facing task proposals.

## Baseline excluding this audit task

At `tasks/tree.json` update `2026-07-14T18:00:17.775Z`, excluding this active audit leaf (`ops/repair-no-executable-work-with-gaps-20260714`), the project had:

- 0 other active leaves
- 0 review leaves visible in the current packet
- 0 waiting leaves
- 0 runnable leaves
- 124 blocked leaves
- 1 backlog audit leaf: `ops/review-blocked-only-frontier-and-seed-local-followup-alert3700-20260714`

So the starvation condition is real: the live frontier is effectively blocked-only unless hidden repo-local work is restored from the compact/spec/model signals.

## What the current signals say

### 1) Compact holders still contain repo-local authoring gaps

The blocked compact holders are not pure external waits.

#### net-integration

`features/net-integration/compact/staging.summary.md` says the exact blocker kind is `repo-local-mixed-terminal-and-promotion-frontier` and explicitly names:

- `Frontier check-only-live-authoring-gap: spec.net-integration.multinic-dualstack, spec.net-integration.multinic-mixed, spec.net-integration.multinic-standard, spec.net-integration.natgw-v2-migration-v2-to-none`
- `Current replay/spec carrier remains intentionally repo-local or check-only; bounded live execute authoring is still missing before status promotion can be truthful.`

But the tree currently represents the whole family only as the blocked holder:

- `hold-compact-net-integration-package-partial-frontier`

Spec-loop state confirms at least two exact members in that authoring-gap subset have **no task linkage at all**:

- `spec.net-integration.multinic-dualstack` → `taskId=null`, `catalogStatus=draft`, review=`skipped_nonlive_lane`, resume=`author an exact direct live carrier`
- `spec.net-integration.multinic-mixed` → `taskId=null`, `catalogStatus=draft`, review=`source_grounded_nonlive`, resume=`author an exact live carrier`

This is repo-local actionable work currently hidden behind a passive holder.

#### network-cni

`features/network-cni/compact/staging.summary.md` says the exact blocker kind is also `repo-local-mixed-terminal-and-promotion-frontier` and explicitly names:

- `Frontier check-only-live-authoring-gap: spec.network-cni.azure-overlay-dual-stack, spec.network-cni.azure-overlay-ilpip, spec.network-cni.vm-prerelease-overlay-cilium-dualstack`
- `Current replay/spec carrier remains intentionally repo-local or check-only; bounded live execute authoring is still missing before status promotion can be truthful.`

The tree currently represents the family only as:

- `hold-compact-network-cni-package-partial-frontier-20260709i`

Spec-loop state shows one of those three members is already represented by an exact wait (`spec.network-cni.azure-overlay-dual-stack` → `wait-spec-network-cni-azure-overlay-dual-stack-row94-live-surface-20260702`), but two are not:

- `spec.network-cni.azure-overlay-ilpip` → `taskId=null`, `catalogStatus=draft`, resume=`owner wants bounded live authoring`
- `spec.network-cni.vm-prerelease-overlay-cilium-dualstack` → `taskId=null`, `catalogStatus=draft`, resume=`author an exact live carrier`

Model-path signals align with that gap:

- `path.network-cni-azure-overlay-ilpip` → `status=unknown`
- `path.network-cni.vm-prerelease-overlay-cilium-dualstack` → `status=draft`

So this family also still contains unrepresented repo-local runnable authoring work.

#### storage-csi

`features/storage-csi/compact/staging.summary.md` says the exact blocker kind is `repo-local-mixed-terminal-and-promotion-frontier` and explicitly names:

- `Frontier alternate-carrier-or-explicit-narrowing-gap: spec.storage-csi.csidrivers`
- `Frontier check-only-live-authoring-gap: spec.storage-csi.file-nfs-unmount-boundary, spec.storage-csi.mcr-mirror-monitor`
- `For the source-grounded subset, ... author bounded live paths for check-only members`

The tree currently compresses the whole family to:

- `hold-compact-storage-csi-successor-pair-and-residual-frontier-20260707`

Spec-loop state shows:

- `spec.storage-csi.csidrivers` → `taskId=null`, `catalogStatus=draft`, resume=`create a separate self-contained carrier or explicitly narrow the claim`
- `spec.storage-csi.file-nfs-unmount-boundary` → `taskId=null`, `catalogStatus=draft`, resume=`author branch-local executable successors or a bounded replacement carrier`
- `spec.storage-csi.mcr-mirror-monitor` is already represented by the exact registry wait family and should stay there unless registry access changes

Model-path signals align with the first two missing executable slices:

- `path.storage-csi-csidrivers` → `status=draft`
- `path.storage-csi-file-nfs-unmount-volume` → `status=draft`

So storage-csi still has repo-local work hidden behind a blocked holder.

### 2) Some families are already truthful exact waits, not missing runnable work

Not every `taskId=null` or non-pass spec implies new runnable work. Several families are already represented by exact waits or explicit owner/runtime gates.

Examples:

- `spec.windows.password-reset-containerd-virtualmachines` and `spec.windows.vm-prerelease-custom-kubelet-config` both point to `wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704`
- `spec.localdns.hosts-plugin` points to `wait-localdns-hosts-plugin-create-http400-body-or-surface-change-20260703`
- `spec.localdns.cni-matrix` points to `wait-localdns-create-http400-residual-family-return-20260704`
- `spec.kms.v2plus-svc-cert-rotation` points to `wait-kms-svc-cert-rotation-underlay-owner-decision-return-20260709`
- `spec.private-cluster-addonv2.coreaddons-privatecluster` points to `wait-private-cluster-jumpbox-key-execution-surface-return-20260704`
- `spec.serverless-virtual-nodes.*` members already map to the shared serverless readiness waits

LocalDNS is a good control case: compact state explicitly says auto-default and hosts-plugin are spec-only waits outside the compact-facing frontier, and the remaining compact-facing LocalDNS frontier is quota/headroom + residual create-time HTTP400 + windows unsupported/nonlive. That is an exact blocked-family representation, not a missing runnable authoring slice.

## Diagnosis

The starvation condition is **not** truthfully explained by “only external waits remain.”

Current controller-visible compact/spec/model signals still show repo-local executable work in at least three blocked families:

1. net-integration
2. network-cni
3. storage-csi

The root problem is that these repo-local authoring/narrowing gaps were compacted into family-level blocked holders without preserving concrete runnable leaf tasks for the exact residual members that still need repo-local work.

## Pre-audit contributor set

The blocked families that materially contributed to the false blocked-only starvation condition were:

- `hold-compact-net-integration-package-partial-frontier`
- `hold-compact-network-cni-package-partial-frontier-20260709i`
- `hold-compact-storage-csi-successor-pair-and-residual-frontier-20260707`

These holders are accurate as family summaries, but inaccurate as the **only** visible frontier because their own maintained summaries/spec-loop state still advertise repo-local authoring or narrowing work.

## Post-action represented set if planner applies the repair

The truthful represented set should become:

- the same blocked holders above, **narrowed to the still-passive members only**, plus
- new runnable domain leaves for the exact repo-local residual authoring/narrowing work listed below.

That converts the project from blocked-only starvation into a mixed frontier: exact waits stay blocked, while authoring gaps regain executable leaves.

## Exact planner-facing task proposals

I am not authorized to create these tasks directly from worker mode. The planner should add the smallest truthful runnable leaves below.

### Proposal A — net-integration live-carrier authoring pair

- **parent**: `aks-feature-compact-loop`
- **suggested id**: `domain/author-net-integration-multinic-live-carrier-pair-20260714`
- **goal**: Author exact bounded live carriers for `spec.net-integration.multinic-dualstack` and `spec.net-integration.multinic-mixed`, rerun the local private-source/live-admission gates, and either promote each branch to truthful live-ready status or return one exact blocker per branch without broad compact reruns.
- **why this is justified now**:
  - compact summary explicitly calls both members `check-only-live-authoring-gap`
  - both specs currently have `taskId=null`
  - both remain draft/source-grounded rather than exact external waits

### Proposal B — network-cni overlay live-carrier authoring pair

- **parent**: `aks-feature-compact-loop`
- **suggested id**: `domain/author-network-cni-overlay-live-carrier-pair-20260714`
- **goal**: Author exact bounded live carriers for `spec.network-cni.azure-overlay-ilpip` and `spec.network-cni.vm-prerelease-overlay-cilium-dualstack`, re-run `check-private-source-policy` plus `check-live-admission`, and either promote each carrier to live-ready or return one exact blocker for the unchanged branch.
- **why this is justified now**:
  - compact summary explicitly lists both as `check-only-live-authoring-gap`
  - both specs currently have `taskId=null`
  - model-path state still shows `unknown` / `draft` rather than a closed exact wait

### Proposal C — storage-csi residual exact-carrier repair

- **parent**: `aks-feature-compact-loop`
- **suggested id**: `domain/reconcile-storage-csi-residual-authoring-gaps-20260714`
- **goal**: Resolve the remaining repo-local storage-csi residuals by (a) choosing an exact alternate carrier or explicit narrowing for `spec.storage-csi.csidrivers`, and (b) authoring or explicitly splitting the bounded executable successors for `spec.storage-csi.file-nfs-unmount-boundary`, while leaving `spec.storage-csi.mcr-mirror-monitor` on its registry-access wait unless that evidence changes.
- **why this is justified now**:
  - compact summary explicitly names `csidrivers` as `alternate-carrier-or-explicit-narrowing-gap`
  - compact summary explicitly names `file-nfs-unmount-boundary` as `check-only-live-authoring-gap`
  - both specs currently have `taskId=null`
  - model-path state still shows `draft`

## Non-proposed drift noted but not required to restore executable work

Some spec-loop entries appear under-linked even when an exact wait already exists (for example certain LocalDNS, GPU, or KMS members). Those are metadata hygiene issues, but they are **not** the starvation root cause because they do not restore truthful runnable work by themselves.

## Conclusion

A proof of “only external waits remain” would be false.

The current app packet still contains repo-local executable gaps in compact/spec/model authority, but the tree currently exposes them only as blocked family holders. The planner should restore the three concrete domain leaves above so the frontier again shows truthful runnable work instead of a blocked-only starvation state.
