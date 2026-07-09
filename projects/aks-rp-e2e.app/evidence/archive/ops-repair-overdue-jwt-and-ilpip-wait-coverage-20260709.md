# Overdue jwt + ILPIP wait coverage repair review — 2026-07-09

Task: `ops-repair-overdue-jwt-and-ilpip-wait-coverage-20260709`
Attempt: `a_ops-repair-overdue-jwt-and-ilpip-wait-coverage-20260709_20260709075528`
Mode: worker evidence / planner review output only; no task-tree mutation from this session

## Result

This session confirms two different truths:

1. `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708` is still the exact shared external wait for the jwt-authenticator blocked family.
2. `hold-spec-network-cni-azure-overlay-ilpip-dualstack-feature-readiness-frontier-20260709` is **not** the smallest truthful ILPIP representation because the tree already contains the older exact same-path holder `wait-spec-network-cni-azure-overlay-ilpip-dualstack-aksenabledualstack-readiness-20260708` for the same run (`171341303`), same spec, same registration surface, and same conflict scope.

So the current active task (`ops-repair-overdue-jwt-and-ilpip-wait-coverage-20260709`) does temporarily cover both waits for the overdue metric, but planner should treat that as audit-time masking only and should reconcile the ILPIP duplicate to one canonical holder.

## Metric logic used

The live metric implementation in `/app/projects/aks-rp-e2e.app/scripts/project-metrics.ts` marks a blocked wait overdue/unworked when:

- `resume_at` or `fallback_at` is in the past, and
- no `active`/`review` task covers it.

Coverage is recognized when an active/review task either:

- explicitly names the blocked wait id in its searchable text, or
- carries the matching `ops:blocked-overdue:<scope>` conflict scope.

That means this task currently covers the two named waits because its goal text explicitly names both ids.

## Fresh recompute

### 1. Self-excluded baseline for this audit task

Direct local recompute using the same metric rules, **excluding this task itself** as required by the overdue-audit rule, returns this pre-audit contributor set:

```json
[
  "hold-spec-network-cni-azure-overlay-ilpip-dualstack-feature-readiness-frontier-20260709",
  "hold-spec-private-cluster-shared-apiserver-subnet-run-28840446579-result-visibility-frontier-20260707h",
  "hold-spec-private-cluster-update-public-second-hop-run-28671841561-artifact-frontier-20260707h",
  "hold-spec-secure-tls-bootstrap-network-isolated-image-pull-after-disable-frontier-20260708",
  "wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708",
  "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708"
]
```

Interpretation:
- before this audit task's masking effect, both the jwt wait and the new ILPIP hold are real overdue contributors;
- four other overdue waits remain unrelated residue.

### 2. Current live metric with this task active

Fresh metric samples from `bun run metrics:sample ... --json` now report:

`aks-rp-e2e.process.blocked.overdue-unworked-count`
```json
{
  "value": 4,
  "sampleSize": 4,
  "offenderTaskIds": [
    "hold-spec-private-cluster-shared-apiserver-subnet-run-28840446579-result-visibility-frontier-20260707h",
    "hold-spec-private-cluster-update-public-second-hop-run-28671841561-artifact-frontier-20260707h",
    "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
    "hold-spec-secure-tls-bootstrap-network-isolated-image-pull-after-disable-frontier-20260708"
  ]
}
```

`aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count`
```json
{
  "value": 4,
  "sampleSize": 4,
  "offenderTaskIds": [
    "hold-spec-private-cluster-shared-apiserver-subnet-run-28840446579-result-visibility-frontier-20260707h",
    "hold-spec-private-cluster-update-public-second-hop-run-28671841561-artifact-frontier-20260707h",
    "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
    "hold-spec-secure-tls-bootstrap-network-isolated-image-pull-after-disable-frontier-20260708"
  ],
  "compatibilityAliasFor": "aks-rp-e2e.process.blocked.overdue-unworked-count"
}
```

Interpretation:
- with this audit task active, jwt and the new ILPIP hold are represented;
- the metric family is **not** locally repaired overall because four other overdue waits still remain uncovered.

## Finding 1 — JWT wait is still the exact shared external wait

Current runtime wait:
- task id: `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`
- state: `blocked`
- parent: `project`
- conflict scope: `ops:shared-jwt-authenticator-egress-gate`
- resume_at: `2026-07-09T07:00:00Z` (already past)
- next_check_at: `2026-07-09T08:45:00Z`
- fallback_at: `2026-07-10T08:45:00Z`

Its blocker still truthfully says the family waits on one of:
- a usable same-path Go e2ev3 `jwt-egress --insecure` surface,
- authoritative no-surface proof, or
- exact reroute.

That remains aligned with the accepted shared-wait evidence in:
- `/app/projects/aks-rp-e2e/design/ops/reconcile-jwt-stale-terminal-warning-20260708.md`
- `/app/projects/aks-rp-e2e/evidence/archive/ops-chase-shared-jwt-authenticator-egress-surface-second-contact-20260709.md`
- `/app/projects/aks-rp-e2e.app/evidence/archive/ops-chase-shared-overdue-jwt-underlay-waits-20260709.md`

The latest accepted chase note proves:
- no controller-visible returned proof exists yet;
- the exact second-contact packet was sent on `2026-07-09T07:22:55.251Z`;
- no unchanged rerun is truthful.

### JWT coverage judgment

For the overdue metric, the jwt wait still needs one active/review app-ops surface while its `resume_at` is already past.

Current state:
- this active audit task covers it now;
- the prior chase task is `done`, so it does **not** count as active metric coverage.

Planner judgment to preserve:
- keep `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708` as the canonical blocked wait;
- keep or replace today’s active audit-time coverage with one sharper active/review app-ops coverage surface that explicitly names this wait or otherwise covers it under the recognized metric rules.

## Finding 2 — The new ILPIP hold is not the smallest truthful representation

Current newer wait:
- task id: `hold-spec-network-cni-azure-overlay-ilpip-dualstack-feature-readiness-frontier-20260709`
- state: `blocked`
- parent: `aks-spec-verification-loop`
- conflict scope: `spec:spec.network-cni.azure-overlay-ilpip-dualstack`
- source run: `171341303`
- blocker meaning: `AKSEnableDualStack` remained unknown while sibling registrations were present

But the tree already contains this older exact holder:
- task id: `wait-spec-network-cni-azure-overlay-ilpip-dualstack-aksenabledualstack-readiness-20260708`
- state: `blocked`
- same parent: `aks-spec-verification-loop`
- same conflict scope: `spec:spec.network-cni.azure-overlay-ilpip-dualstack`
- same source run: `171341303`
- same blocker family: exact same-surface `AKSEnableDualStack` registration/readiness wait

Accepted domain evidence already says the canonical truthful ILPIP frontier is the existing AKSEnableDualStack wait, not a second duplicate holder:

- `evidence/archive/reconcile-spec-network-cni-returned-environment-frontier-20260708.md`
  - concluded ILPIP dualstack should remain on one exact returned-blocker wait keyed to run `171341303`
- `evidence/archive/refresh-spec-network-cni-dual-stack-ilpip-environment-frontier-20260709b.md`
  - concluded the grouped three-spec frontier should stay split and that ILPIP remains an exact feature-readiness wait while the two Windows siblings moved to distinct repaired-carrier paths

### ILPIP representation judgment

`hold-spec-network-cni-azure-overlay-ilpip-dualstack-feature-readiness-frontier-20260709` is therefore a **duplicate blocked holder**, not a sharper one.

The smallest truthful representation is:
- keep one canonical ILPIP wait for run `171341303`, namely `wait-spec-network-cni-azure-overlay-ilpip-dualstack-aksenabledualstack-readiness-20260708`, unless planner intentionally renames/replaces it everywhere in one atomic repair;
- do not preserve both blocked holders.

### ILPIP coverage judgment

Because the newer duplicate hold is currently overdue (`resume_at=2026-07-09T07:41:54Z`), this audit task masks it for the metric today. But planner should not accept that as durable repair. The durable repair is to collapse the duplicate pair to one canonical wait and, if that canonical wait remains overdue, attach one exact app-ops coverage surface to that canonical wait only.

## Represented set: before vs after this audit task

### Pre-audit contributors (excluding this task)

- `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`
- `hold-spec-network-cni-azure-overlay-ilpip-dualstack-feature-readiness-frontier-20260709`
- `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
- `hold-spec-private-cluster-shared-apiserver-subnet-run-28840446579-result-visibility-frontier-20260707h`
- `hold-spec-private-cluster-update-public-second-hop-run-28671841561-artifact-frontier-20260707h`
- `hold-spec-secure-tls-bootstrap-network-isolated-image-pull-after-disable-frontier-20260708`

### Post-action represented by this active task

This active task removes exactly these two from the live offender set:
- `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`
- `hold-spec-network-cni-azure-overlay-ilpip-dualstack-feature-readiness-frontier-20260709`

Current remaining live offender set after that masking:
- `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
- `hold-spec-private-cluster-shared-apiserver-subnet-run-28840446579-result-visibility-frontier-20260707h`
- `hold-spec-private-cluster-update-public-second-hop-run-28671841561-artifact-frontier-20260707h`
- `hold-spec-secure-tls-bootstrap-network-isolated-image-pull-after-disable-frontier-20260708`

## Planner/app-ops action recommended

Because worker mode does not allow task-tree reshaping from this session, planner should apply the repair as tree work after reviewing this note:

1. **JWT**
   - keep `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708` as the single canonical blocked wait;
   - preserve one active/review app-ops coverage surface for it while the wait remains overdue under current metric rules, or refresh/replace the wait contract so it is no longer counted as overdue.

2. **ILPIP**
   - do **not** keep both `hold-spec-network-cni-azure-overlay-ilpip-dualstack-feature-readiness-frontier-20260709` and `wait-spec-network-cni-azure-overlay-ilpip-dualstack-aksenabledualstack-readiness-20260708`;
   - keep one canonical exact same-path wait for run `171341303` only;
   - if planner chooses the older wait as canonical, remove/replace the newer `hold-*20260709` duplicate;
   - if planner chooses the newer id as canonical instead, replace the older one everywhere in one atomic repair so the tree again shows one truthful holder.

3. **Metric residue**
   - after jwt/ILPIP reconciliation, the overdue metric family still has four unrelated offenders, so planner should not treat this task as global recovery.

## Bottom line

- **JWT:** still one truthful shared external wait; keep it and keep one active/review coverage surface while overdue status persists.
- **ILPIP:** the new `hold-*20260709` wait is not the smallest truthful representation because it duplicates the already-existing exact `wait-*20260708` AKSEnableDualStack holder for the same run and scope.
- **Fresh recompute:** this task masks jwt + the new ILPIP hold, but the real remaining overdue-unworked offender set is still four waits, so the metric family is not yet fully repaired.
