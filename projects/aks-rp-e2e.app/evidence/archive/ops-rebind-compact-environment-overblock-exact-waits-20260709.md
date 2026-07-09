# Compact environment-overblock exact-wait rebind review (2026-07-09)

- Task: `ops-rebind-compact-environment-overblock-exact-waits-20260709`
- Attempt: `a_ops-rebind-compact-environment-overblock-exact-waits-20260709_20260709093347`
- Mode: Task Worker Mode
- Runtime tree mutation from this worker: none
- Output purpose: exact rebind evidence/proposal for planner/app-ops application

## Result

I verified the current live carriers for the three targeted compact warning holders:

- `hold-compact-egress-lockdown-package-partial-frontier-202607090915`
- `hold-compact-node-http-proxy-package-partial-frontier-202607090544`
- `hold-compact-jwt-authenticator-package-partial-frontier`

Under the task's **strict replacement rule** — replace only when the sharper carrier preserves the **same resume condition, owner, and affected scope** — **no direct live rebind is safe today**.

Why:

1. **egress-lockdown** already has the right exact spec wait, but its wait owner is `human` while the duplicate compact holder currently carries `aks-explorer` as blocker owner.
2. **node-http-proxy** references a quarantine wait that is no longer live in the runtime tree, and the only live exact trusted-ca wait is an **owner-decision** wait whose resume contract does not match the compact holder's current live-ready-filter contract.
3. **jwt-authenticator** already has the right shared Go e2ev3 send-proof / returned-proof wait, but its owner/resume contract is narrower and more human-return oriented than the generic compact holder's current operator/environment wording.

So the truthful worker outcome is:

- record the exact before/after map,
- confirm which exact carriers already exist,
- confirm where the contract mismatch blocks an automatic rebind,
- and tell planner/app-ops what must be normalized or recreated before the duplicate holders can be retired.

## Sources reviewed

- App runtime tree: `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`
- App compact loop state: `/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json`
- Feature compact summaries:
  - `/app/projects/aks-rp-e2e/features/egress-lockdown/compact/staging.summary.md`
  - `/app/projects/aks-rp-e2e/features/node-http-proxy/compact/staging.summary.md`
  - `/app/projects/aks-rp-e2e/features/jwt-authenticator/compact/staging.summary.md`
- Prior app-ops evidence:
  - `/app/projects/aks-rp-e2e.app/evidence/archive/ops-audit-compact-environment-overblock-warning-family-20260709.md`
  - `/app/projects/aks-rp-e2e.app/evidence/archive/ops-repair-compact-environment-overblock-family-first-batch-20260709b.md`
  - `/app/projects/aks-rp-e2e.app/evidence/archive/ops-repair-compact-environment-overblock-family-second-batch-20260709.md`
  - `/app/projects/aks-rp-e2e.app/evidence/archive/ops-refresh-overdue-jwt-shared-wait-coverage-20260709b.md`

## Baseline contributor set before this review

Ignoring this task itself, the targeted duplicate compact holders are:

1. `hold-compact-egress-lockdown-package-partial-frontier-202607090915`
2. `hold-compact-node-http-proxy-package-partial-frontier-202607090544`
3. `hold-compact-jwt-authenticator-package-partial-frontier`

Per the task acceptance, these were reviewed independently from the unrelated mixed/frontier families that should stay separate:

- `app-routing`
- `aad-rbac`
- `gpu`
- `cluster-autoscaler`
- `machines-agentpool`

## Exact carrier comparison

| Feature | Current duplicate compact holder | Sharper live exact carrier today | Resume condition preserved? | Owner preserved? | Affected scope preserved? | Direct rebind safe now? |
| --- | --- | --- | --- | --- | --- | --- |
| egress-lockdown | `hold-compact-egress-lockdown-package-partial-frontier-202607090915` | `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702` | Yes, materially the same UDR prerequisite proof gate | **No** (`aks-explorer` vs `human`) | Yes, because the compact partial is entirely `spec.egress-lockdown.fips` | **No** |
| node-http-proxy | `hold-compact-node-http-proxy-package-partial-frontier-202607090544` | live referenced quarantine wait is **missing**; only live exact wait is `wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708` | **No** | **No** | Mostly yes for the same trusted-ca carrier | **No** |
| jwt-authenticator | `hold-compact-jwt-authenticator-package-partial-frontier` | `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708` | Close but not identical; shared wait is owner-return proof, holder is operator/environment gate wording | **No** (`operator` vs `human`) | Yes, same `spec.jwt-authenticator.incluster-idp-dex-lifecycle` / same path | **No** |

## 1) Egress-lockdown

### Current duplicate holder

- `hold-compact-egress-lockdown-package-partial-frontier-202607090915`

Its blocker says:

- the only quarantined compact member is `spec.egress-lockdown.fips`
- the package remains partial only because the spec is reviewed-exception and non-live-ready under the current filter
- resume only when `AKS_RP_E2E_UDR_NEXT_HOP_IP` and `AKS_RP_E2E_UDR_PREREQ_PROOF` are supplied, or reviewed evidence changes that prerequisite contract

### Existing exact carrier

- `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`

Its blocker says:

- hold the next meaningful FIPS rerun until exact BYO UDR next-hop / prerequisite proof exists
- resume only when the owner/operator supplies `AKS_RP_E2E_UDR_NEXT_HOP_IP` plus `AKS_RP_E2E_UDR_PREREQ_PROOF` for the same-path rerun, or reviewed evidence changes that prerequisite contract

### Contract check

- **Resume condition:** preserved in substance
- **Affected scope:** preserved in substance because the compact partial is entirely explained by `spec.egress-lockdown.fips`
- **Owner:** **not preserved**
  - compact duplicate holder blocker owner = `aks-explorer`
  - exact wait blocker owner = `human`

### Judgment

This is the closest match, but it still **fails the strict owner-preservation check**.

So planner/app-ops should **not** auto-retire the compact holder as a pure no-text swap from this worker result alone.

### Planner action needed before replacement

Choose one of these exact repairs first:

1. **Normalize ownership intentionally** so the compact-side projection acknowledges the same human-owned prerequisite wait, then retire the duplicate holder; or
2. **Recreate one compact-side exact wait projection** whose owner/resume contract exactly matches the spec-level wait, then replace the generic holder with that projection.

### Before/after ids

- Before: `hold-compact-egress-lockdown-package-partial-frontier-202607090915`
- Proposed exact carrier after owner normalization/projection repair: `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`

## 2) Node-http-proxy

### Current duplicate holder

- `hold-compact-node-http-proxy-package-partial-frontier-202607090544`

Its blocker says:

- create/update rerun `28673740487` already passed
- the only remaining compact blocker is `spec.node-http-proxy.trusted-ca`
- that carrier remains reviewed-exception and intentionally filtered from live dispatch
- resume only after accepted evidence reclassifies `spec.node-http-proxy.trusted-ca` or the compact live-ready policy broadens to include it
- it explicitly references an exact surviving holder named `wait-compact-node-http-proxy-trusted-ca-quarantine-20260702`

### Exact carrier check

I checked the runtime tree for the referenced quarantine wait:

- `wait-compact-node-http-proxy-trusted-ca-quarantine-20260702` -> **missing from live tree**

The only live exact trusted-ca wait I found is:

- `wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708`

That live wait is different. Its blocker says:

- blocked on the routed human owner-decision packet
- resume when `human:operator` returns one exact decision approving redesign, declining to one explicit trusted-ca runtime-input wait, or rerouting the decision surface

### Contract check

Compared with the duplicate compact holder:

- **Resume condition:** **not preserved**
  - duplicate holder = reclassify reviewed-exception or broaden live-ready policy
  - live exact wait = return one exact owner decision about redesign / decline / reroute
- **Owner:** **not preserved**
  - duplicate holder blocker owner = `aks-explorer`
  - live exact wait blocker owner = `human`
- **Affected scope:** materially the same trusted-ca compact carrier, but the decision surface is different

### Judgment

This duplicate holder is **not safely replaceable** by the currently live owner-decision wait.

Also, the exact wait that the duplicate holder itself names as the surviving carrier is no longer live in the runtime tree.

### Planner action needed before replacement

Planner/app-ops should do **one** of these, but not silently substitute the current wait:

1. **Restore/recreate the missing trusted-ca quarantine wait** with the same live-ready-filter / reviewed-exception contract the compact holder currently describes; then retire the generic compact holder in favor of that recreated exact carrier, **or**
2. Intentionally change the representation contract to the human owner-decision wait and rewrite the compact frontier text so owner, resume condition, and fallback all match that decision-boundary meaning.

Until one of those repairs happens, the current holder remains the least misleading live representation.

### Before/after ids

- Before: `hold-compact-node-http-proxy-package-partial-frontier-202607090544`
- Referenced but missing exact carrier to restore/recreate: `wait-compact-node-http-proxy-trusted-ca-quarantine-20260702`
- Existing but non-equivalent live wait: `wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708`

## 3) JWT-authenticator

### Current duplicate holder

- `hold-compact-jwt-authenticator-package-partial-frontier`

Its blocker says:

- the only quarantined member is `spec.jwt-authenticator.incluster-idp-dex-lifecycle`
- that spec is blocked on the Go e2ev3 `jwt-egress --insecure` gate rather than package membership
- owner should add one exact replacement wait holder for that gate rather than leaving a passive package-partial wait
- resume only after the exact Go e2ev3 profile, or an accepted equivalent environment, exposes the gate, or accepted evidence rescopes the path

### Existing exact shared carrier

- `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`

This wait is already live and already carries the accepted lineage:

- 2026-07-08 owner-ask send proof
- 2026-07-09 second-contact chase proof
- no reviewed returned owner/operator signal yet

Its blocker says:

- keep the single shared returned-proof wait for `spec.jwt-authenticator.incluster-idp-dex-lifecycle` / `path.jwt-authenticator.incluster-idp-dex-lifecycle`
- resume only when owner/operator returns exact proof for the Dex ClusterIP issuer ask or a reviewed replacement execution surface for the same path

### Contract check

- **Affected scope:** preserved; both point at the same spec/path
- **Owner:** **not preserved**
  - duplicate holder blocker owner = `operator`
  - shared wait blocker owner = `human`
- **Resume condition:** not strictly identical
  - duplicate holder = environment/profile becomes available or evidence rescopes path
  - shared wait = owner returns proof or replacement surface on the same lineage

### Judgment

This is the correct **sharper family carrier**, and it already exists live.

But under the task's strict direct-replacement test, it still **fails owner/resume-condition equivalence**.

So this worker can confirm that the shared wait is the right exact lineage to use, but cannot truthfully claim that the generic compact holder is already safely swappable without a contract rewrite.

### Planner action needed before replacement

Planner/app-ops should:

1. keep `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708` as the canonical exact shared wait,
2. rewrite the compact-side representation so the compact frontier explicitly inherits that same owner-return/send-proof contract, and then
3. retire `hold-compact-jwt-authenticator-package-partial-frontier` as a duplicate package-partial/environment-looking holder.

This is a **rebind-after-contract-normalization** case, not an immediate no-text replacement case.

### Before/after ids

- Before: `hold-compact-jwt-authenticator-package-partial-frontier`
- Canonical exact shared carrier to bind to: `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`

## Features explicitly kept separate

Per the task acceptance, these families should remain on their own mixed or feature-specific frontiers and were **not** collapsed by this review:

- `app-routing`
- `aad-rbac`
- `gpu`
- `cluster-autoscaler`
- `machines-agentpool`

Nothing in the targeted three-feature review changes the earlier judgment that those families still need their own exact mixed or feature-local frontier representation.

## Proposed post-action represented set

### Safe today without planner contract repair

Keep current exact carriers as the authoritative sharp waits:

- `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`
- `wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708` (not equivalent, but it is the only live exact trusted-ca wait)
- `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`

### Generic duplicate holders still needing planner repair before retirement

- `hold-compact-egress-lockdown-package-partial-frontier-202607090915`
- `hold-compact-node-http-proxy-package-partial-frontier-202607090544`
- `hold-compact-jwt-authenticator-package-partial-frontier`

## Warning-family impact

### Baseline targeted duplicates

- 3 generic compact package-partial holders in the targeted slice

### Immediate safe direct rebinds under strict owner/resume/scope matching

- **0 / 3**

### Why not 3 / 3

- `egress-lockdown`: exact wait exists, but owner mismatch blocks strict direct swap
- `node-http-proxy`: referenced exact quarantine wait is missing; live exact wait is not contract-equivalent
- `jwt-authenticator`: exact shared wait exists, but owner/resume contract still needs normalization before retirement of the generic holder

### Net practical outcome for planner/app-ops

This review narrows the work to **three exact planner repairs** instead of any new broad environment-overblock umbrella:

1. **egress-lockdown** -> owner-normalize / project the existing exact spec wait
2. **node-http-proxy** -> restore/recreate the missing exact quarantine wait or intentionally rewrite onto the human owner-decision wait
3. **jwt-authenticator** -> bind the compact frontier onto the existing shared send-proof / returned-proof wait after owner/resume contract normalization

## Bottom line

The exact-wait evidence is now clear:

- **egress-lockdown** already has the right exact wait, but not yet the same owner contract
- **node-http-proxy** does **not** currently have a live exact wait with the same contract as the duplicate compact holder
- **jwt-authenticator** already has the right shared exact wait lineage, but the compact holder has not yet been rewritten to that same contract

So this worker result is a **planner-ready exact rebind map**, not a runtime-tree mutation:

- no new umbrella environment-overblock wait should be created,
- no unchanged compact rerun should be reopened,
- and the planner should retire the three generic holders only after the exact wait contracts are made equivalent to the live sharp carriers above.
