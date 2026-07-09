# Compact egress-lockdown exact-wait contract normalization review (2026-07-09)

- Task: `ops-normalize-compact-egress-lockdown-exact-wait-contract-20260709`
- Attempt: `a_ops-normalize-compact-egress-lockdown-exact-wait-contract-20260709_20260709094403`
- Mode: Task Worker Mode
- Worker tree mutation: none
- Why no direct mutation from this worker: the assigned task asks for a live task-tree replacement/retirement decision, and worker mode for this session limits me to review/proposal output unless the task explicitly names the exact bounded `task-tree` metadata commands to run.

## Result

Smallest truthful repair: **use the existing cross-loop exact wait `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702` as the single live carrier and retire the compact duplicate holder `hold-compact-egress-lockdown-package-partial-frontier-202607090915` as `replaced`.**

I do **not** recommend creating a new compact-only projection task.

Why this is the smallest repair:

1. The exact human-owned wait already exists and already carries the real resume contract.
2. The compact controller-visible state already projects `egress-lockdown` to that exact wait through `frontierTaskIds = ["wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702"]`.
3. Prior controller repair evidence and tests already show compact pulses should preserve that cross-loop projection and avoid recreating a duplicate package-partial holder when the feature is already represented by an open shared/cross-loop wait.
4. The duplicate holder adds no new retest condition. It only broadens the warning-family surface while the truthful prerequisite remains the same exact UDR proof gate.

## Sources reviewed

- Live task snapshot via CLI:
  - `bun run task-tree show hold-compact-egress-lockdown-package-partial-frontier-202607090915`
  - `bun run task-tree show wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`
  - `bun run task-tree frontier`
- App compact loop state:
  - `/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json`
- Domain compact summary:
  - `/app/projects/aks-rp-e2e/features/egress-lockdown/compact/staging.summary.md`
- Prior repair evidence:
  - `/app/projects/aks-rp-e2e.app/evidence/archive/ops-repair-compact-shared-wait-regeneration-20260709.md`
  - `/app/projects/aks-rp-e2e.app/evidence/archive/ops-rebind-compact-environment-overblock-exact-waits-20260709.md`
  - `/app/projects/aks-rp-e2e.app/evidence/archive/ops-audit-compact-environment-overblock-warning-family-20260709.md`

## Before state

### Duplicate compact holder

`hold-compact-egress-lockdown-package-partial-frontier-202607090915`

Current facts from `task-tree show`:

- state: `blocked`
- parent: `aks-feature-compact-loop`
- owner field: blank
- blocker owner: `aks-explorer`
- blocker text already says to reuse `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`
- blocker resume condition already says to wait for:
  - `AKS_RP_E2E_UDR_NEXT_HOP_IP`
  - `AKS_RP_E2E_UDR_PREREQ_PROOF`
- blocker also says: do not rerun unchanged

### Existing exact carrier

`wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`

Current facts from `task-tree show`:

- state: `blocked`
- parent: `aks-spec-verification-loop`
- owner: `aks-explorer`
- blocker owner: `human`
- blocker condition: exact BYO UDR next-hop/prerequisite proof still missing
- resume condition: wait until the operator supplies the same-path UDR next-hop and prerequisite proof, or reviewed evidence changes the contract
- conflict scope already includes:
  - `feature:egress-lockdown`
  - `spec:spec.egress-lockdown.fips`

### Existing compact-side projection already in state

Current `state.features["egress-lockdown"]` facts from `.state/feature-compact-loop/state.json`:

- `taskId = "hold-compact-egress-lockdown-package-partial-frontier-202607090915"`
- `frontierTaskIds = ["wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702"]`
- `retryReason` explicitly says to reuse `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702` and avoid a duplicate compact passive wait
- `resumeCondition` matches the exact UDR prerequisite contract

So the app already has the needed cross-loop projection signal. The remaining problem is the duplicate live blocked task surface.

## Contract comparison

| Field | Duplicate compact holder | Existing exact wait | Judgment |
| --- | --- | --- | --- |
| Affected scope | `feature:egress-lockdown`; compact package-partial surface caused only by `spec.egress-lockdown.fips` | `feature:egress-lockdown` + `spec:spec.egress-lockdown.fips` | Same underlying family |
| Resume condition | wait for `AKS_RP_E2E_UDR_NEXT_HOP_IP` + `AKS_RP_E2E_UDR_PREREQ_PROOF`, or reviewed evidence changes contract | same | Equivalent |
| Retest condition | do not rerun unchanged before proof exists | same | Equivalent |
| Human-owned prerequisite contract | implied in prose, but blocker owner currently `aks-explorer` | explicit blocker owner `human` | exact wait is the truthful carrier |
| Need for a new compact-side wait task | none; `frontierTaskIds` already points to the exact wait | n/a | do not create another projection task |

## Decision

Choose **owner normalization onto the existing exact wait contract**, not a new compact-side projection task.

Operationally that means:

- keep `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702` open as the only live carrier for this family;
- retire `hold-compact-egress-lockdown-package-partial-frontier-202607090915` as a duplicate `replaced` holder;
- leave the compact family blocked on the same exact human-owned UDR prerequisite proof gate;
- do **not** reopen any compact rerun or broader family rerun.

## Why retirement is now safe

The earlier concern was duplicate regeneration. Current repair evidence removes that concern for this feature family:

- `ops-repair-compact-shared-wait-regeneration-20260709.md` documents that the controller was fixed to treat `feature:*` conflict scopes and persisted `frontierTaskIds` cross-loop projections as valid feature representation.
- The added controller test explicitly covers `egress-lockdown` with `frontierTaskIds = [wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702]` and verifies the pulse does **not** recreate `hold-compact-egress-lockdown-package-partial-frontier`.

That means the existing state projection is enough to preserve representation after the duplicate holder is retired.

## Planner/app-ops mutation to apply

Because this session is worker-scoped review output, the planner/app-ops step should apply the tree mutation.

### Required task-tree mutation

```bash
cd /app/projects/aks-rp-e2e.app && \
  bun run task-tree mark-done \
  hold-compact-egress-lockdown-package-partial-frontier-202607090915 \
  --resolution replaced \
  --summary "Replaced by wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702. Compact state already projects egress-lockdown through frontierTaskIds to the exact human-owned UDR prerequisite wait, so the package-partial holder was a duplicate warning-family surface with no distinct retest condition."
```

### Optional projection hygiene after retirement

No new task is needed, but the next planner/controller pass should ensure compact runtime projection no longer presents the retired holder as the primary `taskId` for `egress-lockdown` if that stale pointer remains in app state. `frontierTaskIds` already points to the correct exact wait.

## Before / after ids

### Before

- duplicate holder: `hold-compact-egress-lockdown-package-partial-frontier-202607090915`
- exact wait: `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`

### After planner applies the repair

- single live carrier: `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`
- retired duplicate: `hold-compact-egress-lockdown-package-partial-frontier-202607090915` with `resolution: replaced`

## Warning-family effect

If planner applies the above mutation:

- the blocked frontier loses one duplicate compact warning holder;
- the egress-lockdown family remains represented once, truthfully, by the exact human-owned UDR prerequisite wait;
- no unchanged compact rerun becomes runnable;
- the warning family becomes narrower and more accurate because it no longer shows both a compact duplicate and the same exact spec-level prerequisite wait.

## Worker conclusion

This task does not need a new AKS-domain judgment or a new compact-side wait artifact. The exact wait already exists and already matches the real resume contract. The remaining durable process repair is simply to let that exact wait be the one live carrier and retire the duplicate compact holder.