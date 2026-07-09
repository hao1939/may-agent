# App-routing compact environment-overblock family audit — 2026-07-09

- Task: `ops-audit-compact-app-routing-environment-overblock-family-20260709`
- Attempt: `a_ops-audit-compact-app-routing-environment-overblock-family-20260709_20260709095549`
- Mode: Task Worker Mode / planner-review output only
- Runtime tree mutation from this worker: none

## Result

I audited the current `app-routing` compact package-partial holder and the environment-blocked warning family it still hides.

### Exact residual environment-blocked members

The current compact ground truth still preserves exactly these **four** residual `accepted-environment-blocked-frontier` members inside `hold-compact-app-routing-package-partial-frontier-202607090657`:

1. `spec.app-routing.vm-prerelease.default-acnginx-internal`
2. `spec.app-routing.vm-prerelease.default-external-nginx.external-public`
3. `spec.app-routing.vm-prerelease.default-internal-nginx.internal-private`
4. `spec.app-routing.vm-prerelease.osm-external-nginx.internal`

### Family decision

There is **no live existing shared environment wait** in the app runtime that truthfully covers this exact quartet today.

A previously created exact quartet carrier existed briefly:

- `hold-spec-app-routing-vm-prerelease-environment-frontier-20260709`

but the spec-loop controller auto-closed it as stale because all four specs are already `pass` in spec-loop state. That makes it unusable as the durable compact-side owner/problem carrier for the current app-routing package-partial frontier.

So the truthful planner action is **not** to bind these four members onto an already-live shared environment wait. The truthful planner action is to **create one narrower compact-facing owner/problem carrier for this exact quartet** and let the current feature-level compact holder stop carrying their environment meaning.

## Sources reviewed

### App runtime authorities

- `/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json`
- `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`
- `/app/projects/aks-rp-e2e.app/.state/spec-loop/state.json`
- `/app/projects/aks-rp-e2e.app/.state/journal.jsonl`

### Domain authorities

- `/app/projects/aks-rp-e2e/features/app-routing/compact/staging.summary.md`
- `/app/projects/aks-rp-e2e/features/app-routing/compact/staging.diagnostics.json`
- `/app/projects/aks-rp-e2e/evidence/archive/review-compact-app-routing-mixed-frontier-and-shared-fixture-20260705.md`
- `/app/projects/aks-rp-e2e/evidence/archive/dispatch-app-routing-request-shape-successor-run-20260704.md`
- `/app/projects/aks-rp-e2e/evidence/archive/reconcile-compact-loop-package-partial-app-routing-row89-followup-proof-20260704.md`

### Prior app-ops reviews used for context

- `/app/projects/aks-rp-e2e.app/evidence/archive/ops-audit-compact-environment-overblock-warning-family-20260709.md`
- `/app/projects/aks-rp-e2e.app/evidence/archive/ops-normalize-app-routing-exact-frontier-holder-surface-20260709.md`

## Baseline contributor set before this audit

Ignoring this audit task itself, the app-visible baseline contributor in the warning family is:

- `hold-compact-app-routing-package-partial-frontier-202607090657`

That holder currently summarizes a **mixed** compact frontier:

- 4 accepted environment-blocked members
- 1 accepted product-gap member
- 4 reviewed-exception members

This audit isolates only the environment-blocked slice and evaluates whether a shared environment family already carries it.

## Ground truth: the four residual environment-blocked members

Current `features/app-routing/compact/staging.summary.md` says the package is partial because the excluded selected members split into exact preserved frontiers, including:

- `accepted-environment-blocked-frontier`
  - `spec.app-routing.vm-prerelease.default-acnginx-internal`
  - `spec.app-routing.vm-prerelease.default-external-nginx.external-public`
  - `spec.app-routing.vm-prerelease.default-internal-nginx.internal-private`
  - `spec.app-routing.vm-prerelease.osm-external-nginx.internal`

Current `features/app-routing/compact/staging.diagnostics.json` repeats the same frontier group in `selectionBlocker.frontierGroups` and preserves the same resume rule:

> Resume each preserved frontier only through its own exact owner action, gate change, evidence promotion, or policy repair; do not merge these members back into one environment-shaped compact wait.

Current app-owned compact state also preserves the same mixed-frontier truth for `app-routing`:

- `taskId = hold-compact-app-routing-package-partial-frontier-202607090657`
- `retryReason` says the remaining live-dispatch blocker is exactly four accepted environment-blocked members, one accepted product-gap member, and four reviewed-exception members.
- `nextStepClassification` says to preserve the exact split between accepted environment-blocked, accepted product-gap, and reviewed-exception app-routing frontiers.

## Exact audit of existing shared-carrier candidates

## 1. Current compact holder is too broad

`hold-compact-app-routing-package-partial-frontier-202607090657` is still the live holder in the runtime tree.

Its current goal is:

> Preserve the exact app-routing mixed residual compact frontier (4 accepted environment-blocked + 1 product-gap + 4 reviewed-exception members) without reopening an unchanged broad compact rerun.

That is truthful as a temporary mixed holder, but it is **not** the desired carrier for the environment quartet specifically. It still hides the actionable environment slice inside the feature-level mixed frontier.

## 2. The older four-spec same-run request-shape wait is not the right live carrier

Prior domain evidence from:

- `review-compact-app-routing-mixed-frontier-and-shared-fixture-20260705.md`
- `dispatch-app-routing-request-shape-successor-run-20260704.md`
- `reconcile-compact-loop-package-partial-app-routing-row89-followup-proof-20260704.md`

shows an older exact same-run review family around run `28698006097` for this four-spec set:

- `default-acnginx-internal`
- `osm-acnginx-internal`
- `osm-internal-nginx-internal`
- `osm-external-nginx.internal`

That is **not** the current exact residual environment quartet anymore:

- it includes `osm-acnginx-internal` and `osm-internal-nginx-internal`, which are now live-ready and no longer in the excluded set;
- it does **not** include `default-external-nginx.external-public`, which *is* in the current excluded environment quartet;
- and the runtime tree no longer shows a live `wait-app-routing-request-shape-run-28698006097-review-20260704` holder to bind against.

So that historical same-run review branch is useful evidence for lineage, but it is **not** the current live shared environment wait for the residual quartet.

## 3. A new exact quartet holder was created, but it is already closed

The runtime tree shows a task explicitly created for the exact quartet:

- `hold-spec-app-routing-vm-prerelease-environment-frontier-20260709`

Its goal was already the right shape:

> Preserve one exact blocked holder for the accepted app-routing VM-prerelease environment-blocked quartet so compact app-routing can bind a truthful frontier surface without restoring the retired broad request-shape wait or reopening unchanged reruns.

Its acceptance explicitly named the same four members audited here.

But the same tree entry also shows it is now `done`, with result:

> Closed stale blocked wait because every named spec already has live pass evidence: spec.app-routing.vm-prerelease.default-acnginx-internal, spec.app-routing.vm-prerelease.default-external-nginx.external-public, spec.app-routing.vm-prerelease.default-internal-nginx.internal-private, spec.app-routing.vm-prerelease.osm-external-nginx.internal.

The supporting journal entries show:

- it was created at `2026-07-09T08:31:15.367Z`
- it was auto-closed by the spec-loop controller at `2026-07-09T08:32:58.434Z`
- the stale-close reason was `all spec ids named by this blocked wait are already pass in spec-loop state`

That exact stale-close behavior is also consistent with `spec-loop/state.json`, where all four audited specs currently show:

- `status = pass`
- but `catalogStatus = blocked`
- and `catalogSpecState = environment-blocked`

So the app currently has a **representation mismatch**:

- spec-loop pass-backed evidence makes the spec-loop controller auto-close quartet waits, while
- compact ground truth still intentionally keeps the same four specs in the accepted environment-blocked compact frontier.

Therefore the already-created `hold-spec-app-routing-vm-prerelease-environment-frontier-20260709` proves the *right scope*, but it is **not a live reusable shared wait today**.

## Why no existing shared environment family can be reused as-is

A truthful reusable carrier would need all of the following:

1. exact affected scope = the current four residual compact members,
2. durable blocked state that survives spec-loop `pass` status,
3. compact-appropriate resume condition,
4. no contamination from the retired older request-shape set,
5. and no duplication of the product-gap or reviewed-exception slices.

No current live wait in the runtime tree satisfies all five conditions.

- The mixed compact holder is too broad.
- The old run `28698006097` lineage wait is not live and not the same member set.
- The newly created quartet holder had the right scope but auto-closed immediately because it lived on the spec-loop stale-wait path.

## Planner-ready repair: create one narrower owner/problem carrier

Because no live shared family already carries this slice correctly, planner/app-ops should create **one narrower compact-facing owner/problem carrier** for the exact quartet.

### Minimum truthful carrier shape

Suggested carrier purpose:

> Preserve one exact blocked holder for the accepted app-routing VM-prerelease environment-blocked quartet so compact app-routing can bind a truthful frontier surface without restoring the retired broad request-shape wait or reopening unchanged reruns.

### Exact affected scope

- `spec.app-routing.vm-prerelease.default-acnginx-internal`
- `spec.app-routing.vm-prerelease.default-external-nginx.external-public`
- `spec.app-routing.vm-prerelease.default-internal-nginx.internal-private`
- `spec.app-routing.vm-prerelease.osm-external-nginx.internal`

### Why this should be compact-facing, not spec-loop stale-wait facing

The just-closed `hold-spec-app-routing-vm-prerelease-environment-frontier-20260709` shows that a spec-loop parent/contract is the wrong lifecycle for this carrier. The compact frontier is preserving an **accepted non-live-ready environment boundary**, not asking spec-loop to wait for first pass.

So the repaired carrier should live where spec-loop stale-pass closure will **not** immediately retire it.

### Exact owner/problem meaning to preserve

The compact summary and diagnostics currently describe these four members as:

- accepted environment-blocked,
- already pass-backed or otherwise evidence-backed on bounded same-path carriers,
- still intentionally excluded from compact live-ready dispatch,
- and resumable only through exact owner action, gate change, evidence promotion, or policy repair.

That means the new carrier should preserve a compact-side resume condition like:

> Resume only when reviewed same-surface environment/capability evidence, owner-approved promotion, or intentional compact-eligibility reclassification materially changes the current non-live-ready boundary for one or more members of this exact quartet. Do not reopen an unchanged broad compact rerun.

## Post-action represented set planner should aim for

### Before

- `hold-compact-app-routing-package-partial-frontier-202607090657`
  - carries 4 environment-blocked + 1 product-gap + 4 reviewed-exception members together

### After planner repair

Keep the existing exact non-environment holders already preserved elsewhere:

- `hold-spec-app-routing-default-domain-istio-hello-world-on-tls-product-gap-20260705`
- `wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705`
- `wait-spec-app-routing-rollback-istio-to-nginx-existing-target-return-20260708`
- and any accepted exact product-gap / reviewed-exception carrier planner is already using for `default-domain-tls-lifecycle` and `tls-lifecycle-rotation`

Add one exact compact-facing environment quartet carrier for:

- `default-acnginx-internal`
- `default-external-nginx.external-public`
- `default-internal-nginx.internal-private`
- `osm-external-nginx.internal`

Then leave `hold-compact-app-routing-package-partial-frontier-202607090657` only as:

- a temporary mixed summary holder pending full exact-holder projection, or
- a reduced holder for any residue not yet represented exactly

but **not** as the only live carrier of this environment slice.

## Bottom line

The exact residual app-routing environment-overblock family is the following four-member quartet:

- `spec.app-routing.vm-prerelease.default-acnginx-internal`
- `spec.app-routing.vm-prerelease.default-external-nginx.external-public`
- `spec.app-routing.vm-prerelease.default-internal-nginx.internal-private`
- `spec.app-routing.vm-prerelease.osm-external-nginx.internal`

There is **no current live shared environment wait** that truthfully carries those four members in app runtime state.

A correct quartet holder was briefly created as `hold-spec-app-routing-vm-prerelease-environment-frontier-20260709`, but spec-loop stale-pass closure retired it immediately because all four specs already have pass-backed spec-loop evidence.

So the planner should **create/recreate one narrower compact-facing owner/problem carrier for this exact quartet** instead of pretending an existing shared environment family already covers it, and the broad feature-level compact holder should stop hiding that actionable environment slice once the new exact carrier exists.
