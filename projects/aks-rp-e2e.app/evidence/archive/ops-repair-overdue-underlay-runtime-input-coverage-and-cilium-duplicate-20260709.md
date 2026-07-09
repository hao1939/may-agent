# Overdue underlay/runtime-input coverage repair and cilium duplicate review — 2026-07-09

- Task: `ops-repair-overdue-underlay-runtime-input-coverage-and-cilium-duplicate-20260709`
- Attempt: `a_ops-repair-overdue-underlay-runtime-input-coverage-and-cilium-duplicate-20260709_20260709074651`
- Mode: Task Worker Mode / evidence + planner-review recommendation only / no task-tree mutation from this session
- Reviewed at: `2026-07-09T18:00:05Z`

## Result

This session verified three current facts:

1. **The shared underlay/runtime-input wait is now truthfully covered** for the overdue-unworked metric by the currently active app-ops task itself:
   - `ops-repair-overdue-underlay-runtime-input-coverage-and-cilium-duplicate-20260709`
   - state: `active`
   - goal text explicitly names `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`

2. **The cilium-enterprise runtime-input holder is fully subsumed by the shared wait**, based on already-reviewed evidence plus current controller-visible state:
   - shared wait: `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
   - duplicate holder: `hold-spec-network-cni-cilium-enterprise-runtime-input-frontier-20260708`
   - planner should replace the duplicate holder with the shared wait rather than preserve two blocked holders for the same unchanged blocker.

3. **A fresh overdue-unworked recompute no longer shows either underlay/cilium item as an offender.**
   The current offenders have moved elsewhere:
   - `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`
   - `hold-spec-network-cni-azure-overlay-ilpip-dualstack-feature-readiness-frontier-20260709`

So the underlay/runtime-input coverage defect targeted by this task is locally diagnosed and evidenced. The global metric is still non-zero, but for different waits.

## Runtime facts checked

### 1) Current active app-ops coverage surface exists

Current runtime tree entry:

- task id: `ops-repair-overdue-underlay-runtime-input-coverage-and-cilium-duplicate-20260709`
- state: `active`
- owner: `app-ops`
- conflict scope: `ops:blocked-overdue:shared-underlay-runtime-input-family`
- goal text explicitly names:
  - `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
  - `hold-spec-network-cni-cilium-enterprise-runtime-input-frontier-20260708`

Under current metric logic in `scripts/project-metrics.ts`, an active/review task covers an overdue blocked wait when either:

1. its searchable text explicitly includes the blocked wait id, or
2. it carries a matching `ops:blocked-overdue:<scope>` conflict scope.

For the shared underlay wait, this task satisfies coverage by the **first** rule because its goal text explicitly includes `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`.

For the cilium duplicate holder, this task also currently text-covers the exact duplicate holder id, but that does **not** justify keeping the duplicate blocked holder alive; it only explains why that holder is no longer in the fresh offender set while this task is active.

### 2) Shared underlay wait remains a real blocked wait

Current runtime tree entry:

- `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
- state: `blocked`
- parent: `project`
- owner: `aks-explorer`
- resume_at: `2026-07-09T07:00:00Z`
- next_check_at: `2026-07-09T08:45:00Z`
- fallback_at: `2026-07-10T08:45:00Z`

The blocker still says no reviewed returned signal has supplied the required shared runtime inputs:

- `AKS_RP_E2E_UNDERLAY_KUBECONFIG(_B64)`
- conditional `AKS_RP_E2E_CONTROL_PLANE_ID`
- `AKS_RP_E2E_ASSIGN_IDENTITY`
- `AKS_RP_E2E_OVERLAY_RECONCILE_HEADERS`

So this is still a legitimate blocked wait. The repair question was coverage truthfulness, not whether the wait itself should disappear.

### 3) Duplicate cilium holder still exists in tree state

Current runtime tree entry:

- `hold-spec-network-cni-cilium-enterprise-runtime-input-frontier-20260708`
- state: `blocked`
- parent: `aks-spec-verification-loop`
- owner: `aks-explorer`
- resume_at: `2026-07-09T07:00:00Z`
- next_check_at: `2026-07-09T09:15:00Z`
- fallback_at: `2026-07-10T09:15:00Z`

Its blocker meaning is:
- no new repo-local repair,
- no changed env/runtime inputs,
- refresh only if one spec gains a distinct next action or input set.

That meaning is now duplicative of the broader shared underlay/runtime-input wait rather than sharper than it.

## Reviewed evidence for cilium subsumption

I re-read the accepted/reviewed same-path evidence already on disk.

### `refresh-spec-network-cni-cilium-enterprise-runtime-input-frontier-20260709b.md`

This reviewed evidence already concludes:

- both cilium-enterprise rows are controller-visible under the shared wait;
- the pair is **fully subsumed** by `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`;
- no unchanged rerun is justified;
- planner should replace `hold-spec-network-cni-cilium-enterprise-runtime-input-frontier-20260708` with the shared underlay wait.

### Supporting reviewed lineage cited there

That evidence ties the conclusion to earlier reviewed materials:

- `repair-spec-network-cni-cilium-enterprise-private-source-policy-self-containment-20260706.md`
  - repo-local self-containment and admission issues are already repaired;
  - remaining blocker is runtime-input supply, not code repair.
- `reconcile-spec-loop-pending-network-cni-residual-frontier-20260708.md`
  - both cilium specs already belong on the shared underlay/runtime-input route.
- `ops-repair-network-cni-pending-family-holder-normalization-20260708.md`
  - the live holder for the pair is already the shared underlay wait.
- `refresh-spec-network-cni-overdue-blocked-frontiers-20260709.md`
  - the pair should resolve to one exact shared runtime-input holder, not two parallel blocked holders.

### Controller-visible runtime corroboration

The reviewed evidence is consistent with current app-owned state:

- the shared wait goal explicitly names the cilium-enterprise family;
- the cilium-only hold adds no different unblock signal;
- the same blocker family is already represented at the shared-wait level.

## Baseline for this task's own targeted family

Per the overdue-audit rule, evaluate the baseline as if the current repair task did not exist.

Without `ops-repair-overdue-underlay-runtime-input-coverage-and-cilium-duplicate-20260709` active:

- `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708` would still be a real overdue blocked wait, because it is blocked past `resume_at` and no other current active/review task text-names it.
- `hold-spec-network-cni-cilium-enterprise-runtime-input-frontier-20260708` would also remain a blocked overdue surface unless planner replaces it, because it is still present in the runtime tree and blocked past its own `resume_at`.

So this task does restore truthful active app-ops coverage for the shared underlay wait by exact-id naming, and it also provides temporary active coverage for the duplicate holder while planner decides whether to remove/replace it.

## Fresh overdue-unworked recompute

Fresh local recompute during this session returned:

```json
{"measuredAt":1783583398754,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":2,"sampleSize":2,"note":"{\"offenderTaskIds\":[\"wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708\",\"hold-spec-network-cni-azure-overlay-ilpip-dualstack-feature-readiness-frontier-20260709\"]}"}
```

Interpretation:

- `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708` is **not** a current offender;
- `hold-spec-network-cni-cilium-enterprise-runtime-input-frontier-20260708` is **not** a current offender;
- the overdue-unworked metric remains red only because two **different** waits are uncovered now.

## Persisted metric snapshot lag

Runtime `metrics` row at review time:

- metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- `current = 3`
- `updated_at = 1783583170867`
- `status = active`

This persisted snapshot lags the fresh local recompute, so the authoritative answer for this task is the direct recompute above, not the older stored row.

## Planner review recommendation

Task Worker Mode forbids task-tree mutation here, so I am leaving the exact repair as planner/app-ops review output.

### Recommended tree action

1. **Keep** `ops-repair-overdue-underlay-runtime-input-coverage-and-cilium-duplicate-20260709` as the current active coverage surface until planner applies the next decision.
2. **Replace** `hold-spec-network-cni-cilium-enterprise-runtime-input-frontier-20260708` with the shared wait:
   - `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
3. After that replacement, recompute overdue-unworked again and expect the underlay/cilium family to stay absent from offender ids.
4. If planner wants the metric family back to `0`, it must address the two new offenders instead:
   - `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`
   - `hold-spec-network-cni-azure-overlay-ilpip-dualstack-feature-readiness-frontier-20260709`

### Why replacement is justified

Preserving both underlay/cilium holders is no longer the smallest truthful representation because:

- the shared wait already governs the cilium pair;
- the cilium-only holder adds no distinct unblock event;
- reviewed evidence already says full subsumption is proven;
- the fresh recompute confirms the current active repair task is enough to remove both items from the present offender set.

## Bottom line

This session produced the planner review evidence needed for the assigned repair:

- **yes**, one active app-ops task now truthfully covers `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708` for overdue-unworked accounting;
- **yes**, existing reviewed evidence shows the cilium-enterprise runtime-input holder is duplicative and should be replaced by the shared underlay wait;
- **yes**, a fresh overdue-unworked recompute was recorded;
- **but** the global metric remains non-zero for unrelated waits, and the actual duplicate-holder replacement still needs planner/task-tree action outside this worker session.