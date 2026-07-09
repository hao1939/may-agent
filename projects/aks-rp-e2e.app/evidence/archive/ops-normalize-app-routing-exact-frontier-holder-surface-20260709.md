# App-routing exact frontier holder-surface normalization audit — 2026-07-09

- Task: `ops-normalize-app-routing-exact-frontier-holder-surface-20260709`
- Attempt: `a_ops-normalize-app-routing-exact-frontier-holder-surface-20260709_20260709082438`
- Mode: Task Worker Mode / planner-app-ops review output only
- Runtime authorities reviewed:
  - `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`
  - `/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json`
- Domain authorities reviewed:
  - `/app/projects/aks-rp-e2e/features/app-routing/compact/staging.summary.md`
  - `/app/projects/aks-rp-e2e/features/app-routing/compact/staging.diagnostics.json`
  - `/app/projects/aks-rp-e2e/evidence/archive/review-compact-app-routing-mixed-frontier-and-shared-fixture-20260705.md`
  - `/app/projects/aks-rp-e2e/evidence/archive/reconcile-compact-loop-package-partial-app-routing-row89-followup-proof-20260704.md`
  - `/app/projects/aks-rp-e2e/evidence/archive/reconcile-compact-loop-package-partial-task-a_reconcile-compact-loop-package-partial-202607090138_20260709014539-worker.md`

## Result

Partial, with an exact planner-ready holder map.

The repaired compact runtime now persists `frontierTaskIds` for `app-routing`, so the old runtime/schema blocker is no longer the main issue. The remaining gap is **holder-surface completeness in the live app task tree**.

Today the live runtime still keeps one generic compact blocked holder:

- `hold-compact-app-routing-package-partial-frontier-202607090657`

and also preserves three exact frontier links in compact state:

- `hold-spec-app-routing-default-domain-istio-hello-world-on-tls-product-gap-20260705`
- `wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705`
- `wait-spec-app-routing-rollback-istio-to-nginx-existing-target-return-20260708`

That is progress, but it is **not yet the full exact-holder surface** required by the maintained app-routing residual split frontier. The live tree still lacks exact surviving holders for:

1. the entire **accepted-environment-blocked** quartet,
2. the **accepted-product-gap** `default-domain-tls-lifecycle` member, and
3. the **reviewed-exception** `tls-lifecycle-rotation` member.

So the generic compact holder is still carrying missing surface, not just stale wording.

## Ground truth: the maintained residual split frontier

Current maintained compact summary/diagnostics say app-routing is partial because the 9 quarantined selected members split into exactly three frontier groups:

### A. `accepted-environment-blocked-frontier`

- `spec.app-routing.vm-prerelease.default-acnginx-internal`
- `spec.app-routing.vm-prerelease.default-external-nginx.external-public`
- `spec.app-routing.vm-prerelease.default-internal-nginx.internal-private`
- `spec.app-routing.vm-prerelease.osm-external-nginx.internal`

### B. `accepted-product-gap-frontier`

- `spec.app-routing.default-domain-tls-lifecycle`

### C. `reviewed-exception-frontier`

- `spec.app-routing.default-domain-istio-hello-world`
- `spec.app-routing.default-domain-tls-secret`
- `spec.app-routing.rollback-istio-to-nginx`
- `spec.app-routing.tls-lifecycle-rotation`

The maintained resume condition is also group-specific: resume each preserved frontier only through its own exact owner action, gate change, evidence promotion, or policy repair.

## What the live app runtime currently exposes

## 1. Compact state already preserves a partial exact frontier set

Current `/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json` for `app-routing` now shows:

- `taskId = hold-compact-app-routing-package-partial-frontier-202607090657`
- `frontierTaskIds = [hello-world holder, tls-secret holder, rollback holder]`
- `nextStepClassification = preserve exact split between accepted environment-blocked, accepted product-gap, and reviewed-exception app-routing frontiers`

So the new runtime shape is present and app-routing is no longer collapsed to only one pointer.

## 2. The live tree still keeps one generic compact holder

Current `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json` contains:

- `hold-compact-app-routing-package-partial-frontier-202607090657`

Current facts on that holder:

- `state = blocked`
- `parent = aks-feature-compact-loop`
- `owner = ""` (empty)
- `context.featureCompactExactWait = true`
- `blocker.waiting_for.type = owner.decision`
- goal text still summarizes the whole 4+1+4 split in one holder

That means the holder text is sharper than before, but the task identity and blocked contract are still a merged compact-level umbrella.

## Existing exact holder surface vs missing exact holder surface

## Existing exact holders already live

### Reviewed-exception frontier — present now

These three exact holders already exist in the live tree and already appear in `frontierTaskIds`:

| Residual member | Live exact holder | Current wait type |
| --- | --- | --- |
| `spec.app-routing.default-domain-istio-hello-world` | `hold-spec-app-routing-default-domain-istio-hello-world-on-tls-product-gap-20260705` | `blocker.resolved` |
| `spec.app-routing.default-domain-tls-secret` | `wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705` | `evidence.available` |
| `spec.app-routing.rollback-istio-to-nginx` | `wait-spec-app-routing-rollback-istio-to-nginx-existing-target-return-20260708` | `environment.available` |

These are truthful exact surviving surfaces and should remain part of the app-routing compact frontier binding.

## Missing exact holders still needed

### 1. Accepted product-gap frontier — missing exact holder

Maintained frontier member:

- `spec.app-routing.default-domain-tls-lifecycle`

Current live tree result:

- **no blocked live holder found** for this spec in `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`

Why this matters:

- the maintained app-routing compact summary explicitly preserves `default-domain-tls-lifecycle` as the sole `accepted-product-gap-frontier` member,
- but the live task tree does not currently provide a durable exact holder for it,
- so the compact runtime cannot bind the full product-gap surface even though the summary/diagnostics say it exists.

### 2. Reviewed-exception frontier — missing `tls-lifecycle-rotation` holder

Maintained frontier member:

- `spec.app-routing.tls-lifecycle-rotation`

Current live tree result:

- **no blocked live holder found** for this spec in `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`

Why this matters:

- the maintained summary keeps this member on the reviewed-exception frontier because the prerequisite initial TLS-secret gate is still blocked,
- but there is no exact blocked holder in the live tree for that preserved reviewed-exception member,
- so the compact runtime currently binds only three of the four reviewed-exception members.

### 3. Accepted environment-blocked frontier — entire quartet missing live exact holders

Maintained frontier members:

- `spec.app-routing.vm-prerelease.default-acnginx-internal`
- `spec.app-routing.vm-prerelease.default-external-nginx.external-public`
- `spec.app-routing.vm-prerelease.default-internal-nginx.internal-private`
- `spec.app-routing.vm-prerelease.osm-external-nginx.internal`

Current live tree result:

- **no live exact blocked holder currently exists for any of these four specs** in `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`

Important nuance:

- earlier domain evidence proves these four were previously rehomed under same-run review `wait-app-routing-request-shape-run-28698006097-review-20260704`,
- and accepted single-spec pass evidence / repaired compact carrier evidence exists for these members,
- but that older same-run wait is **not present anymore** in the current live runtime tree,
- so the present app task tree no longer exposes any durable exact holder carrying the accepted-environment-blocked frontier.

This is the largest remaining hole in the app-routing exact frontier surface.

## Exact keep/create-normalize map

| Frontier group | Required exact holder surface | Current live status | Planner judgment |
| --- | --- | --- | --- |
| accepted-environment-blocked | one durable exact frontier-group holder or four exact child holders covering the VM-prerelease environment-blocked quartet | missing | create or normalize |
| accepted-product-gap | one durable exact holder for `spec.app-routing.default-domain-tls-lifecycle` | missing | create or normalize |
| reviewed-exception | exact holders for `istio-hello-world`, `tls-secret`, `rollback-istio-to-nginx`, `tls-lifecycle-rotation` | 3 present, `tls-lifecycle-rotation` missing | keep existing 3; create or normalize 1 missing holder |

## Smallest truthful holder surface

The smallest truthful holder surface is **not** nine new sibling leaves.

Because the maintained compact summary already groups the residual frontier into three durable buckets, the smallest truthful app-process move is:

### Keep as-is

- `hold-spec-app-routing-default-domain-istio-hello-world-on-tls-product-gap-20260705`
- `wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705`
- `wait-spec-app-routing-rollback-istio-to-nginx-existing-target-return-20260708`

### Create or normalize exactly three missing surfaces

1. **one accepted-environment-blocked frontier-group holder** for the four VM-prerelease environment-blocked members,
2. **one accepted-product-gap exact holder** for `spec.app-routing.default-domain-tls-lifecycle`,
3. **one reviewed-exception exact holder** for `spec.app-routing.tls-lifecycle-rotation`.

Why this is the smallest truthful move:

- it completes all three maintained frontier groups,
- it avoids inventing four separate environment leaves unless the planner specifically wants that finer split,
- and it gives compact reprojection a complete exact-holder surface without broad rerun churn.

## Why I did not mutate the tree from this session

This assigned task asks for normalization analysis and allows either task-tree update or exact no-change justification. In this worker session, direct runtime tree mutation was not explicitly delegated through the narrow supported task-tree commands described in worker-mode instructions.

So I treated this as planner/app-ops review output:

- read the live app tree and compact state,
- compared them with maintained compact ground truth,
- identified the exact holder surface already present vs missing,
- and recorded the minimum planner-side change needed.

## Exact no-change / blocker judgment

This is **not** a full no-change justification.

The missing prerequisite is now bounded and concrete:

- the repaired runtime can persist `frontierTaskIds`,
- the live app-routing state already stores three exact holders,
- but the live tree still lacks the remaining exact holder surface for the other frontier groups.

So the blocker is **not** code shape anymore. It is **incomplete live holder representation**.

## Planner-ready next move

Planner/app-ops should add the smallest exact holder completion, then rerun one bounded compact pulse/reprojection:

1. preserve the existing three exact holders already bound in `frontierTaskIds`;
2. create or normalize:
   - one exact accepted-environment-blocked frontier-group holder for the four VM-prerelease members,
   - one exact `default-domain-tls-lifecycle` product-gap holder,
   - one exact `tls-lifecycle-rotation` reviewed-exception holder;
3. rerun the compact-loop controller once so `app-routing.frontierTaskIds` can bind the complete 3-group surface;
4. only after that decide whether the generic compact holder `hold-compact-app-routing-package-partial-frontier-202607090657` can be retired, kept as backward-compatibility anchor, or rewritten as a pure summary holder.

## Bottom line

The app-routing compact frontier is now past the old single-pointer limitation, but the live tree is still short one complete exact holder surface.

Current truthful picture:

- **already exact and live:** hello-world, tls-secret, rollback-istio-to-nginx
- **still missing from live tree:** environment-blocked quartet, tls-lifecycle, tls-lifecycle-rotation

So the smallest concrete next app-process move is:

> finish the missing three exact holder surfaces, then reprojection can bind a complete `frontierTaskIds` set for app-routing without another broad rerun or a false environment-only umbrella wait.
