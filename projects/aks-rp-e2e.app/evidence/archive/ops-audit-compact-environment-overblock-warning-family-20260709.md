# Compact environment-overblock warning family audit (2026-07-09)

- Task: `ops-audit-compact-environment-overblock-warning-family-20260709`
- Attempt: `a_ops-audit-compact-environment-overblock-warning-family-20260709_20260709072004`
- Scope: compact warning-family holders starting with `app-routing`, `cluster-autoscaler`, and `egress-lockdown`
- Worker-mode note: this memo is review/proposal output only. I did **not** mutate the runtime task tree from this session.

## Sources reviewed

- `/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json`
- `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`
- `/app/projects/aks-rp-e2e/features/app-routing/compact/staging.summary.md`
- `/app/projects/aks-rp-e2e/features/cluster-autoscaler/compact/staging.summary.md`
- `/app/projects/aks-rp-e2e/features/egress-lockdown/compact/staging.summary.md`
- `/app/projects/aks-rp-e2e.app/evidence/archive/ops-repair-compact-app-routing-exact-frontier-projection-20260709.md`
- `/app/projects/aks-rp-e2e.app/evidence/archive/ops-repair-feature-compact-multi-frontier-projection-app-routing-20260709.md`
- `/app/projects/aks-rp-e2e.app/evidence/archive/ops-repair-compact-environment-overblock-family-second-batch-20260709.md`

## Family verdict

There is **no truthful single shared environment wait** that should carry all three flagged compact holders together.

The family splits three ways:

1. `app-routing` remains a **mixed residual frontier**, not one shared environment wait.
2. `cluster-autoscaler` remains **one exact seven-member compact frontier**, but its current generic feature-level holder should be sharpened.
3. `egress-lockdown` is the clear **collapse case**: its compact holder should give way to the already-existing exact spec wait.

So the truthful outcome is **not** one umbrella environment blocker. The truthful outcome is one preserved mixed-frontier hold, one sharper exact frontier successor, and one shared exact wait replacement.

## Baseline contributor set before this audit

Ignoring this audit task itself, the warning-family contributors visible in current app state are:

- `hold-compact-app-routing-package-partial-frontier-202607090657`
- `hold-compact-cluster-autoscaler-package-partial-frontier-202607090657`
- `hold-compact-egress-lockdown-package-partial-frontier-202607090657`

These are the pre-audit holders that currently make the family look more generically environment-blocked than it really is.

## Per-holder decision

### 1) `hold-compact-app-routing-package-partial-frontier-202607090657`

**Decision:** keep this family represented as an **exact mixed-frontier hold for now**. Do **not** replace it with one shared environment wait.

### Why

Current compact authority says app-routing is still partial because 9 selected members split into three different frontier groups:

- `accepted-environment-blocked-frontier` (4 members)
- `accepted-product-gap-frontier` (1 member)
- `reviewed-exception-frontier` (4 members)

`features/app-routing/compact/staging.summary.md` says exactly that split and names the members.

Current app-owned compact state still points app-routing at one holder:

- `taskId = hold-compact-app-routing-package-partial-frontier-202607090657`
- `rootCauseClassification = repo-local-spec-metadata-split-frontier`
- `retryReason` says the remaining blocker is the residual split frontier: four accepted environment-blocked members, one accepted product-gap member, and four reviewed-exception members.

The app-routing projection repair notes also show two important facts:

1. multi-frontier persistence now exists in app code via `frontierTaskIds`, but
2. the live app-routing proving case still lacks a complete exact-holder surface for all three residual frontier groups, so the runtime cannot yet fully replace the current compact holder with exact links alone.

### Why unchanged reruns remain forbidden

Because the current compact package is already fully selected and still truthfully regenerates as partial on the same 4+1+4 split. Another unchanged broad app-routing compact rerun would only replay the same mixed frontier.

### Exact next owner action that now carries this family

Planner/app-ops should keep app-routing represented as one **mixed-frontier hold** until the exact frontier-group task surface exists for:

- the 4-member accepted environment slice,
- the 1-member product-gap slice,
- the 4-member reviewed-exception slice.

After those exact frontier-group holders exist, planner can reproject app-routing onto `frontierTaskIds`. Until then, a single shared environment wait would be false.

### Related exact holders already visible

The tree already has some exact app-routing blockers, including:

- `wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705`
- `hold-spec-app-routing-default-domain-istio-hello-world-on-tls-product-gap-20260705`
- `wait-spec-app-routing-rollback-istio-to-nginx-existing-target-return-20260708`

Those prove the split is real, but they do not yet form the complete live compact-side frontier set.

---

### 2) `hold-compact-cluster-autoscaler-package-partial-frontier-202607090657`

**Decision:** do **not** merge this into one shared environment wait. It should gain a **sharper exact seven-member frontier successor**.

### Why

Current compact authority for `cluster-autoscaler` says the package is partial because exactly 7 selected members remain quarantined, all in one `accepted-environment-blocked-frontier`:

- `spec.cluster-autoscaler.vm-prerelease-autoscaling-base`
- `spec.cluster-autoscaler.vm-prerelease-local-storage-runtime`
- `spec.cluster-autoscaler.vm-prerelease-mincount-recovery`
- `spec.cluster-autoscaler.vm-prerelease-row49-overscale-node-stability`
- `spec.cluster-autoscaler.vm-prerelease-scale-from-zero-labels-fips`
- `spec.cluster-autoscaler.vm-prerelease-service-principal`
- `spec.cluster-autoscaler.vm-prerelease-spot`

`features/cluster-autoscaler/compact/staging.summary.md` says the remaining truth is one exact accepted-environment-blocked seven-member frontier.

Current compact state agrees:

- `taskId = hold-compact-cluster-autoscaler-package-partial-frontier-202607090657`
- `rootCauseClassification = repo-local-spec-metadata-single-frontier`
- `retryReason` says broad rerun is untruthful because the package still regenerates as partial with one exact accepted-environment-blocked seven-member frontier.

The broader tree already contains sharper exact carriers for this family, including the seven spec-level waits and holds, plus the older compact-side exact family holder:

- `hold-compact-cluster-autoscaler-vm-prerelease-current-head-frontier-20260707`

### Why unchanged reruns remain forbidden

Because all 25 active feature-owned specs are already selected into the compact package, and the same seven-member frontier remains the only live-dispatch blocker. Another unchanged broad compact rerun would not change that frontier.

### Exact next owner action that now carries this family

Planner/app-ops should replace the current generic package-partial holder with one **explicit seven-member compact frontier representation** aligned to the current maintained summary.

That can be done either by:

1. rewriting the current compact holder so its live meaning is explicitly the seven-member frontier, or
2. replacing it with one sharper compact frontier successor that links the seven existing exact spec-level holders.

### Important caution

Do **not** collapse cluster-autoscaler into the same shared environment family as app-routing or egress-lockdown.

Also do **not** rely blindly on the older `hold-compact-cluster-autoscaler-vm-prerelease-current-head-frontier-20260707` wording without review, because that older holder still describes a `3+3+1` mixed split while the newer maintained compact summary now says the current surviving compact truth is one accepted-environment-blocked seven-member frontier.

So the planner follow-up here is a **sharpen/rebind** action, not a family merge.

---

### 3) `hold-compact-egress-lockdown-package-partial-frontier-202607090657`

**Decision:** replace this compact holder with the already-existing shared exact wait:

- `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`

### Why

Current compact authority for `egress-lockdown` says only one selected member remains quarantined:

- `spec.egress-lockdown.fips`

`features/egress-lockdown/compact/staging.summary.md` says that quarantined member remains blocked on the truthful UDR next-hop / prerequisite contract and must not rerun unchanged without explicit prerequisite proof.

Current compact state already points to the same conclusion:

- `taskId = hold-compact-egress-lockdown-package-partial-frontier-202607090657`
- `retryReason` explicitly says to reuse `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702` and avoid a duplicate compact passive wait.

The current compact holder is therefore only a duplicate projection surface, not the best durable carrier.

### Why unchanged reruns remain forbidden

Because `spec.egress-lockdown.fips` still lacks the exact prerequisite inputs named in both the compact summary and the existing wait:

- `AKS_RP_E2E_UDR_NEXT_HOP_IP`
- `AKS_RP_E2E_UDR_PREREQ_PROOF`

Without those, another rerun would be unchanged churn on the same prerequisite contract.

### Exact next owner action that now carries this family

Planner/app-ops should let `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702` be the single live representation and retire the duplicate compact-side holder from warning-family presentation.

This is the clearest immediate reconciliation in the audited family.

## Post-audit represented set if planner applies this memo

### Keep

- `hold-compact-app-routing-package-partial-frontier-202607090657`
  - but treat it explicitly as a mixed-frontier hold, not an environment-family wait

### Sharpen / replace with exact frontier successor

- `hold-compact-cluster-autoscaler-package-partial-frontier-202607090657`
  - replace or rewrite into one explicit seven-member frontier carrier aligned to current maintained compact authority

### Collapse to exact shared wait

- replace `hold-compact-egress-lockdown-package-partial-frontier-202607090657` with:
  - `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`

## Net result

For this warning family:

- `app-routing` should **stay** as an exact mixed-frontier hold for now.
- `cluster-autoscaler` should **gain a sharper exact successor**, not a merged environment wait.
- `egress-lockdown` should **collapse to one shared exact wait** that already exists.

That leaves no justification for a new umbrella environment-overblock wait across these three compact holders, and it names the exact next carrier for each family branch.
