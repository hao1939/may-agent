# repair-compact-overdue-owner-decision-family-20260710

- Task: `ops/repair-compact-overdue-owner-decision-recovery-20260710`
- Attempt: `a_ops_repair-compact-overdue-owner-decision-recovery-20260710_20260710035538`
- Reviewed at: `2026-07-10T11:43:09Z`
- Mode: Task Worker Mode / planner-review output only unless the assigned task explicitly names bounded `task-tree` commands
- Runtime tree mutation from this worker: none

## Result

I reviewed the overdue compact owner-decision family exactly as assigned:

1. `hold-compact-aad-rbac-package-partial-frontier`
2. `hold-compact-defender-profile-reviewed-exception-frontier`
3. `hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier`
4. shared wait `wait-ccp-security-patch-reviewed-exception-owner-response-20260708`

The truthful recovery is **not** to reopen unchanged compact reruns.

Current best planner/app-ops action is:

- **keep** `hold-compact-aad-rbac-package-partial-frontier` as a compact-local mixed frontier carrier, but refresh its owner-decision evidence/watch times against the three exact downstream blockers it already summarizes;
- **keep** `hold-compact-defender-profile-reviewed-exception-frontier` as the compact-local promotion/reclassification carrier, but refresh its owner-decision evidence/watch times from the accepted defender promotion review instead of treating it like a rerun candidate;
- **keep** one shared CCP owner-response lineage only, with `hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier` continuing to point at `wait-ccp-security-patch-reviewed-exception-owner-response-20260708`;
- **refresh** `wait-ccp-security-patch-reviewed-exception-owner-response-20260708` so the current lineage anchor is the existing 2026-07-09 **third-contact** packet/send-proof chain rather than the stale second-contact wording still present in the live tree;
- **do not** create duplicate compact-local rerun, diagnosis, or secondary CCP wait work.

Because this worker task did not explicitly authorize bounded live `task-tree update-text` / `task-tree set-outputs` commands on the named ids, I did not mutate the runtime tree. This memo records the exact current facts, the pre-audit contributor set, the truthful replacement/refresh target state, and the minimal planner/app-ops apply actions.

## Baseline method

Per worker-mode audit rules, I computed the family baseline as if this audit task itself did not exist.

Checked sources:

- `/app/projects/aks-rp-e2e.app/tasks/tree.json`
- `/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json`
- `/app/projects/aks-rp-e2e.app/.state/approval-dispatch-runs.jsonl`
- runtime `events` table for `project.approval.requested`, `message.created`, and `project.approval.submitted`
- compact/spec evidence files already attached to these lineages

## Pre-audit contributor set

The overdue compact owner-decision family, excluding this audit task itself, is currently represented by these four live ids:

1. `hold-compact-aad-rbac-package-partial-frontier`
2. `hold-compact-defender-profile-reviewed-exception-frontier`
3. `hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier`
4. `wait-ccp-security-patch-reviewed-exception-owner-response-20260708`

Important distinction:

- `aad-rbac` and `defender-profile` are compact-local holders whose fallback windows expired without a new controller-visible refresh.
- `ccp-security-patch` already has the correct **shared** spec-loop owner-response wait, but that wait still advertises the older second-contact anchor even though third-contact proof already exists.

## Family-by-family judgment

## 1) `hold-compact-aad-rbac-package-partial-frontier`

### Current live truth

The live holder is already a truthful residual compact frontier, not a generic rerun surface.

Its blocker text already says the compact blocker surface is now only:

- `spec.aad-rbac.azure-rbac-automatic-sku`
- `spec.aad-rbac.managed-v2-lifecycle`
- `spec.aad-rbac.run-command-access`

and that `spec.aad-rbac.nonaad-to-aadv2-migration` was already cleared by reviewed pass run `28847520644`.

The exact downstream represented branches already exist in the tree:

- `wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702`
- `hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705`
- `hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706`

Those three exact blockers remain truthful and are the real surviving frontier for this compact feature.

### Why no unchanged rerun is truthful

The holder already preserves that all feature-owned specs are selected into the compact package and that the remaining boundary is a mixed reviewed-exception / promotion / authorization frontier rather than missing package membership.

So the truthful recovery is **refresh**, not rerun.

### Overdue gap

The compact holder still shows its own expired compact-loop watch fields from `2026-07-09T03:52:20Z` even though the real downstream owner/capacity family remains unchanged.

### Planner/app-ops apply meaning

Refresh this holder as a compact-local summary carrier aligned to the three exact downstream blockers above.

Recommended future watch alignment:

- next review window: align to the latest of the already-governing downstream owner-review windows, i.e. after the `2026-07-10T18:20:00Z` run-command-access / `2026-07-10T18:00:00Z` row37+capacity review sweep
- fallback window: one owner-review cycle later, e.g. `2026-07-11T18:20:00Z`

### Keep / replace decision

- **Keep** `hold-compact-aad-rbac-package-partial-frontier`
- **Refresh** its evidence/watch times
- **Do not** create a duplicate compact-local rerun or duplicate spec-loop wait

## 2) `hold-compact-defender-profile-reviewed-exception-frontier`

### Current live truth

The current compact state and live holder both preserve the same exact frontier:

- compact package is selected and check-passing
- accepted evidence already proves the request-plus-runtime floor
- remaining work is owner promotion or explicit compact-eligibility reclassification of `spec.defender-profile.vm-prerelease-matrix`

The governing accepted review note is:

- `evidence/archive/review-compact-defender-profile-promotion-frontier-20260704.md`

The compact state says:

- `rootCauseClassification = execute-ready-promotion-frontier-after-request-runtime-floor-proof`
- `nextStepClassification = owner promotion or compact-eligibility reclassification under the accepted request-plus-runtime floor`
- `taskId = hold-compact-defender-profile-reviewed-exception-frontier`

### Why no unchanged rerun is truthful

The accepted defender review already says the remaining blocker is classification of already-supported evidence, not missing execution evidence.

So the truthful recovery is again **refresh**, not rerun.

### Overdue gap

Like `aad-rbac`, this holder still has stale compact-loop watch fields from `2026-07-09T03:52:22Z`.

Unlike CCP, there is no separate shared owner-response wait id already carrying the exact same boundary. The holder itself is currently the compact-facing carrier.

### Planner/app-ops apply meaning

Refresh this holder using the accepted defender promotion review as the authoritative current evidence surface.

Recommended future watch alignment:

- next review window: new owner-decision review slot after this overdue audit, e.g. `2026-07-10T18:30:00Z`
- fallback window: one owner-review cycle later, e.g. `2026-07-11T18:30:00Z`

### Keep / replace decision

- **Keep** `hold-compact-defender-profile-reviewed-exception-frontier`
- **Refresh** its evidence/watch times from `review-compact-defender-profile-promotion-frontier-20260704.md`
- **Do not** rebind it to unrelated auth/runtime waits and **do not** reopen a bounded rerun

## 3) `hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier`

### Current live truth

This compact holder is already correctly narrowed.

It already says:

- it is only a split-frontier carrier for feature-local compact state;
- the exact represented blocker remains `wait-ccp-security-patch-reviewed-exception-owner-response-20260708`;
- no duplicate environment setup or unchanged rerun is truthful.

Compact state also matches that same truth:

- `taskId = hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier`
- last reviewed run remains `28678450306`
- MarinerV2 still fails with `InvalidOSSKU`
- Windows2022 / Windows2025 still lack source-authorized carriers

### Why no compact-local replacement is needed

The compact holder is already correctly chained through the shared spec-loop owner-response wait. There is no value in creating a second compact-only CCP wait.

### Keep / replace decision

- **Keep** `hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier` unchanged as the compact-local carrier
- **Do not** duplicate the shared owner-response lineage inside compact-local state

## 4) `wait-ccp-security-patch-reviewed-exception-owner-response-20260708`

### Current live truth

This exact spec-loop wait remains the correct shared owner-response lineage for:

- `spec.ccp-security-patch.mariner-v2-prod-mtc`
- `spec.ccp-security-patch.windows2022-prod-mtc`
- `spec.ccp-security-patch.windows2025-prod-mtc`

It also remains the exact blocker that compact CCP should stay aligned to.

### Current stale part

The live task tree still uses **second-contact** wording in this wait:

- blocker condition still names `evidence/archive/spec-loop-overdue-owner-response-second-contact-packet-20260709.md`
- fallback action still says refresh after the `2026-07-09 second-contact chase`

But the newer shared lineage already exists and is durable:

- first-contact packet/send proof: `evidence/archive/ops-send-ccp-security-patch-owner-packet-20260708.md`
- combined third-contact packet: `evidence/archive/spec-loop-overdue-owner-response-third-contact-packet-20260709.md`
- approval-dispatch ledger row at `2026-07-09T07:18:05.218Z`
- runtime events show accepted `project.approval.requested` + `message.created` for that third-contact path

### Returned-decision check

I found **no** controller-visible `project.approval.submitted` event for:

- `ccp-security-patch-reviewed-exception-owner-source-authority-20260708`
- `spec-loop-overdue-owner-response-third-contact-packet-20260709.md`
- `wait-ccp-security-patch-reviewed-exception-owner-response-20260708`

So the truthful state is still response-await, but on the **third-contact** lineage, not second-contact.

### Planner/app-ops apply meaning

Refresh the existing wait in place.

Specifically:

- keep the same task id: `wait-ccp-security-patch-reviewed-exception-owner-response-20260708`
- keep the compact holder chained to it
- rewrite blocker/fallback text so the current anchor is the third-contact packet/send-proof chain
- roll watch windows forward

Recommended future watch alignment:

- next review window: `2026-07-10T18:00:00Z`
- fallback window: `2026-07-11T18:00:00Z`

## Shared-lineage alignment decision for CCP

Preserve exactly this shared lineage:

- shared live wait: `wait-ccp-security-patch-reviewed-exception-owner-response-20260708`
- compact-local carrier: `hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier`

Do **not** create:

- a duplicate compact CCP owner-response wait,
- a duplicate compact rerun task,
- or a second compact-local diagnosis branch.

The compact holder should remain aligned exactly by continuing to say it is represented by `wait-ccp-security-patch-reviewed-exception-owner-response-20260708`, once that wait is refreshed to the third-contact lineage.

## Recommended post-action represented set

If planner/app-ops applies the minimal truthful refresh, the represented family should be:

1. `hold-compact-aad-rbac-package-partial-frontier`
   - refreshed as mixed frontier carrier for:
     - `wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702`
     - `hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705`
     - `hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706`
2. `hold-compact-defender-profile-reviewed-exception-frontier`
   - refreshed as the exact owner promotion / compact-eligibility reclassification carrier
3. `wait-ccp-security-patch-reviewed-exception-owner-response-20260708`
   - refreshed to the third-contact lineage
4. `hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier`
   - unchanged compact-local carrier represented by the refreshed shared CCP wait

Compared with the pre-audit set, the represented ids stay almost the same; the key change is that the CCP shared wait becomes **freshly anchored** and the two compact-local overdue holders (`aad-rbac`, `defender-profile`) regain current watch windows instead of remaining fallback-expired.

## Minimal planner/app-ops apply packet

Because worker mode here did not authorize the live edits, planner/app-ops should apply the narrowest possible repair.

### CCP shared wait

1. Rewrite `wait-ccp-security-patch-reviewed-exception-owner-response-20260708` blocker/fallback wording from second-contact to third-contact.
2. Keep outputs anchored to:
   - `../aks-rp-e2e/evidence/archive/ops-send-ccp-security-patch-owner-packet-20260708.md`
   - `../aks-rp-e2e/evidence/archive/spec-loop-overdue-owner-response-third-contact-packet-20260709.md`
3. Roll `next_check_at` / `resume_at` / `fallback_at` forward.

### aad-rbac compact holder

1. Keep `hold-compact-aad-rbac-package-partial-frontier`.
2. Refresh its blocker note so it explicitly stays aligned to the three exact downstream blockers already named above.
3. Roll compact-local watch fields forward to the next owner-review sweep.

### defender-profile compact holder

1. Keep `hold-compact-defender-profile-reviewed-exception-frontier`.
2. Refresh its blocker note from the accepted defender promotion review.
3. Roll compact-local watch fields forward to the next owner-review sweep.

## Systemic follow-up discovered

This family shows a repeated fallback pattern in the compact loop:

- compact owner-decision holders can remain truthful in content,
- but their compact-local `next_check_at` / `fallback_at` fields expire independently of the downstream spec-loop owner-response or owner-review lineages,
- which produces repeated overdue-family repair work even when the real blocker has not changed and the correct exact downstream lineage already exists.

### Concrete follow-up the planner should add

Add one ops repair follow-up for blocked-frontier owner-decision stewardship, for example:

- **proposed task**: `ops/repair-compact-owner-decision-watch-normalization-20260710`

### Exact scope for that follow-up

Normalize compact owner-decision holders so that when a compact holder:

- is already a compact-local carrier for downstream exact waits, or
- is an accepted owner-promotion frontier with no truthful rerun candidate,

its watch-window refresh follows one durable rule instead of expiring independently and repeatedly triggering the same overdue audit family.

That follow-up should especially cover:

- mixed compact carriers like `aad-rbac`,
- accepted promotion frontiers like `defender-profile`, and
- compact holders represented by shared owner-response waits like `ccp-security-patch-os-variants`.

## Bottom line

This family does **not** need reopened compact reruns.

It needs one narrow blocked-frontier maintenance pass:

- refresh `aad-rbac` as the same mixed compact carrier,
- refresh `defender-profile` as the same promotion/reclassification carrier,
- refresh `wait-ccp-security-patch-reviewed-exception-owner-response-20260708` to the existing third-contact lineage,
- keep `hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier` aligned to that one shared wait,
- and add one small ops follow-up so compact owner-decision holders stop repeatedly expiring without a real frontier change.
