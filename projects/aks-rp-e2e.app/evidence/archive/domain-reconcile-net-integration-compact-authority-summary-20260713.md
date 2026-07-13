# Domain follow-up: net-integration compact authority summary repair — 2026-07-13

- Task: `domain-reconcile-net-integration-compact-authority-summary-20260713-foll`
- Attempt: `a_domain-reconcile-net-integration-compact-authority-summary-20260713-foll_20260713030126`
- Mode: Task Worker Mode / maintained compact artifact repair
- Runtime task-tree mutation from this worker: none

## What changed

I repaired the maintained domain compact authority so the generated net-integration compact artifacts now distinguish:

1. the **15-member active frontier**,
2. the **2 consumed pass-history members**,
3. the **exact outbound-UDR wait**, and
4. the **four nonlive/source-grounded members**.

## Domain files changed

### 1) Generator / maintained compact classification logic

Updated `runner/feature-compact.ts` so compact generation can represent pass-consumed compact residue separately from the active live frontier.

Key repair points:

- added a `consumed-pass-history` compact eligibility bucket,
- taught `compactEligibility()` to honor `spec.compactDisposition === "consumed-pass-history"`,
- added `activeFrontierSpecIds` and `consumedPassHistorySpecIds` to generated diagnostics,
- kept `liveDispatchGate.excludedSpecIds` and `selectionBlocker.remainingSpecIds` aligned to the **active** frontier only,
- refreshed summary wording so the generated markdown no longer treats consumed pass history as active quarantined frontier.

### 2) Two consumed pass-history specs marked explicitly

Updated these maintained spec files:

- `features/net-integration/specs/net-integration-outbound-migration-natgw-to-none.json`
- `features/net-integration/specs/net-integration-outbound-migration-none-to-lb.json`

Both now carry:

```json
"compactDisposition": "consumed-pass-history"
```

This lets the compact generator preserve them as selected historical members without leaving them in the active live-dispatch blocker set.

### 3) Exact outbound-UDR wait preserved in maintained spec wording

Updated:

- `features/net-integration/specs/net-integration-outbound-udr.json`

The maintained `statusReason` now explicitly preserves:

- exact wait id: `wait-spec-net-integration-outbound-udr-virtualappliance-prerequisite-supply-20260702`
- exact meaning: keep outbound-UDR separate from any broader compact successor lane.

## Regenerated maintained compact outputs

Re-ran:

```bash
bun runner/feature-compact.ts net-integration --target staging
```

This regenerated:

- `features/net-integration/compact/staging.summary.md`
- `features/net-integration/compact/staging.diagnostics.json`
- `features/net-integration/compact/staging.plan.json`

## Resulting maintained authority

### Active compact frontier: 15 members

The regenerated summary/diagnostics now preserve the active frontier as these 15 members:

#### Accepted environment / terminal members (11)

- `spec.net-integration.basiclb-migration-lb`
- `spec.net-integration.basiclb-migration-natgw`
- `spec.net-integration.cross-subscription-vnet`
- `spec.net-integration.custom-route-table-user-assigned-msi`
- `spec.net-integration.natgw-v2-byoip`
- `spec.net-integration.natgw-v2-byoip-prefix`
- `spec.net-integration.natgw-v2-ds-byoip-v4ip-v6ip`
- `spec.net-integration.natgw-v2-ds-byoip-v4prefix-v6ip`
- `spec.net-integration.outbound-migration-lb-to-none`
- `spec.net-integration.outbound-migration-none-to-natgw`
- `spec.net-integration.outbound-udr`

#### Source-grounded / nonlive members (4)

- `spec.net-integration.multinic-dualstack`
- `spec.net-integration.multinic-mixed`
- `spec.net-integration.multinic-standard`
- `spec.net-integration.natgw-v2-migration-v2-to-none`

These four remain grouped under the regenerated source-grounded frontier bucket:

- `check-only-live-authoring-gap`

### Consumed pass history: 2 members

The regenerated summary now preserves these separately from the active frontier:

- `spec.net-integration.outbound-migration-natgw-to-none`
- `spec.net-integration.outbound-migration-none-to-lb`

### Exact outbound-UDR wait remains separate

The regenerated maintained authority still keeps outbound-UDR inside the active frontier while preserving its exact separate wait:

- `wait-spec-net-integration-outbound-udr-virtualappliance-prerequisite-supply-20260702`

## Concrete evidence from regenerated artifacts

### Summary surface

`features/net-integration/compact/staging.summary.md` now states:

- `15 active-frontier quarantined for live dispatch`
- `2 consumed pass-history members`
- the 15 active-frontier member list
- a separate line for consumed pass history:
  - `spec.net-integration.outbound-migration-natgw-to-none`
  - `spec.net-integration.outbound-migration-none-to-lb`

### Diagnostics surface

`features/net-integration/compact/staging.diagnostics.json` now records:

- `compactLiveReadiness.activeFrontierSpecIds` with 15 members,
- `compactLiveReadiness.consumedPassHistorySpecIds` with 2 members,
- `selectionBlocker.remainingSpecIds` narrowed to the 15-member active frontier,
- `liveDispatchGate.excludedSpecIds` narrowed to the 15-member active frontier.

## Remaining app-owned stale state outside worker scope

The domain repair is complete, but current app-owned/controller-visible state still reflects the older broader representation in places outside worker authority.

Evidence from current app state inspected during this task:

- `feature-compact-loop/state.json` still reports a 17-member broader mixed frontier in `lastSummary` / `ownerReason`.
- task `hold-compact-net-integration-package-partial-frontier` already has the correct goal shape, but the controller-visible loop summary still needs refresh to match the regenerated domain artifacts.

Because Task Worker Mode forbids task-tree reshaping or app-state edits here, I did **not** mutate app loop state or the runtime task tree.

## Planner / app-ops next verification step

Planner/app-ops should now do one narrow sync step:

1. refresh the app-owned net-integration compact holder/loop metadata from the regenerated domain artifacts,
2. preserve `hold-compact-net-integration-package-partial-frontier`,
3. preserve exact outbound-UDR wait `wait-spec-net-integration-outbound-udr-virtualappliance-prerequisite-supply-20260702`,
4. keep the active frontier at 15 members,
5. keep the two outbound migration pass rows represented only as consumed pass history, not as active frontier members.

## Bottom line

The maintained domain compact artifacts are no longer stale in the reviewed way.

They now truthfully show:

- **15-member active frontier**,
- **exact outbound-UDR wait**,
- **4 nonlive/source-grounded members**,
- **2 consumed pass-history specs kept out of the active frontier**.
