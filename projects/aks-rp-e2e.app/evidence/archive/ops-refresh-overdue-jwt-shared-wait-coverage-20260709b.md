# Refresh overdue coverage — shared JWT wait — 2026-07-09

- Task: `ops-refresh-overdue-jwt-shared-wait-coverage-20260709b`
- Attempt: `a_ops-refresh-overdue-jwt-shared-wait-coverage-20260709b_20260709081324`
- Reviewed at: `2026-07-09T18:00:05Z`
- Wait under review: `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`

## Judgment

`wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708` is still the smallest truthful shared holder for the jwt-authenticator blocked-infra family.

The freshest lineage is still **send-proof**, not **returned-proof**:
- first-contact owner ask routed on `2026-07-08`;
- second-contact/chase routed on `2026-07-09`; and
- **no controller-visible returned owner/operator outcome yet**.

So there is still no sharper owner-return or reroute surface to replace the wait today.

The prior alert-coverage task `ops-maintain-shared-jwt-authenticator-overdue-coverage-alert-3249-20260709` is now `done`, so it no longer counts as active overdue coverage. The only current active/review coverage surface for this wait is the assigned task itself, `ops-refresh-overdue-jwt-shared-wait-coverage-20260709b`.

## Self-excluded baseline required by review

Per the overdue-audit rule, compute the baseline as if **this task did not exist**.

Under the current metric logic in `scripts/project-metrics.ts`, a blocked overdue wait is suppressed only when some **other** `active` or `review` task covers it by either:
1. explicitly naming the blocked wait id in its task text, or
2. carrying a matching `ops:blocked-overdue:<scope>` conflict scope.

The relevant implementation is:
- `taskCoversBlockedOverdueWait(...)` in `scripts/project-metrics.ts`
- `blockedOverdueUnworkedTaskIds` derived only from `active`/`review` tasks

For this jwt wait specifically:
- the canonical blocked wait is still `blocked` and overdue;
- `ops-maintain-shared-jwt-authenticator-overdue-coverage-alert-3249-20260709` is `done`, not `active`/`review`;
- `ops-repair-overdue-jwt-and-ilpip-wait-coverage-20260709` is also `done`, not `active`/`review`;
- no other current `active` or `review` task in the tree textually names `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`; and
- no other current `active` or `review` task carries project-wide blocked-overdue coverage that would cover this project-root wait.

Therefore, **if `ops-refresh-overdue-jwt-shared-wait-coverage-20260709b` were excluded, `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708` would still be an overdue-unworked contributor.**

Truthful self-excluded baseline for this specific wait:
- baseline contributor: `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`
- reason it would contribute: overdue blocked wait with no other active/review recovery surface
- current representing task when not self-excluded: `ops-refresh-overdue-jwt-shared-wait-coverage-20260709b`

## Current wait still remains exact

From `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json` the live wait remains:

- id: `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`
- state: `blocked`
- owner: `aks-explorer`
- goal: hold the single shared returned-proof wait for `spec.jwt-authenticator.incluster-idp-dex-lifecycle` / `path.jwt-authenticator.incluster-idp-dex-lifecycle`
- accepted resume outcomes:
  1. usable same-path Go e2ev3 `jwt-egress --insecure` execution surface,
  2. authoritative no-surface proof, or
  3. exact reroute for the same in-cluster Dex ClusterIP issuer path
- watch times currently recorded on the wait:
  - `resume_at = 2026-07-09T07:00:00Z`
  - `next_check_at = 2026-07-09T08:45:00Z`
  - `fallback_at = 2026-07-10T08:45:00Z`

The blocker text still matches the current state: no unchanged rerun is justified until returned proof or a reviewed replacement surface exists.

## Latest send-proof lineage

### 1. First-contact owner ask still stands

Packet:
- `/app/projects/aks-rp-e2e/evidence/archive/jwt-authenticator-go-e2ev3-egress-surface-owner-ask-20260708.md`

Durable send proof re-verified:
- approval-dispatch ledger row at `2026-07-08T07:09:14.124Z`
- packet path: `evidence/archive/jwt-authenticator-go-e2ev3-egress-surface-owner-ask-20260708.md`
- path id: `path.jwt-authenticator.incluster-idp-dex-lifecycle`

### 2. Second-contact chase is the freshest exact owner-action evidence

Packet:
- `/app/projects/aks-rp-e2e/evidence/archive/ops-chase-shared-jwt-authenticator-egress-surface-second-contact-20260709.md`

Runtime event proof re-verified:
- `project.approval.requested`
  - event id: `2929713`
  - timestamp: `2026-07-09 07:22:41 UTC`
  - `data.params.packetPath = evidence/archive/ops-chase-shared-jwt-authenticator-egress-surface-second-contact-20260709.md`
  - `data.params.pathId = shared-jwt-authenticator-go-e2ev3-egress-surface-second-contact-20260709`
- `message.created`
  - event id: `2929745`
  - timestamp: `2026-07-09 07:22:54 UTC`
  - owner: `human:operator`
- `handler.workflow_dispatched`
  - event id: `2929746`
  - timestamp: `2026-07-09 07:22:55 UTC`
- approval-dispatch ledger row at `2026-07-09T07:22:55.251Z`
  - packet path: `evidence/archive/ops-chase-shared-jwt-authenticator-egress-surface-second-contact-20260709.md`
  - path id: `shared-jwt-authenticator-go-e2ev3-egress-surface-second-contact-20260709`

That second-contact packet is the freshest exact routed owner-action lineage for this shared wait.

## Returned-proof audit

I checked runtime events for the exact jwt lineage and found **no controller-visible returned outcome**.

Queried event types:
- `message.received`
- `project.approval.response`
- `project.approval.responded`
- `owner.response.received`

Matching filters used:
- `jwt-authenticator-go-e2ev3-egress-surface-owner-ask-20260708.md`
- `ops-chase-shared-jwt-authenticator-egress-surface-second-contact-20260709.md`
- `path.jwt-authenticator.incluster-idp-dex-lifecycle`
- `shared-jwt-authenticator-go-e2ev3-egress-surface-second-contact-20260709`

Result:
- no rows matched those response event types for this lineage

So current truth remains:
- send proof exists,
- chase proof exists,
- returned proof does not yet exist,
- no exact reroute exists,
- no authoritative no-surface reply exists.

## Active overdue-coverage path now

The earlier jwt coverage task is closed:
- `ops-maintain-shared-jwt-authenticator-overdue-coverage-alert-3249-20260709`
- state: `done`

The exact current active coverage surface is:
- `ops-refresh-overdue-jwt-shared-wait-coverage-20260709b`
- state: `active`
- conflict scope: `ops:blocked-overdue:jwt-shared-wait`
- goal explicitly names `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`

That means overdue coverage for this wait no longer depends on the stale finished task. It depends on this currently active task.

## Metric state now

### Live recompute including current active coverage

Fresh local recompute at review time returned:

```json
{"measuredAt":1783584890355,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":3,"sampleSize":3,"note":"{\"offenderTaskIds\":[\"hold-spec-private-cluster-shared-apiserver-subnet-run-28840446579-result-visibility-frontier-20260707h\",\"hold-spec-private-cluster-update-public-second-hop-run-28671841561-artifact-frontier-20260707h\",\"hold-spec-secure-tls-bootstrap-network-isolated-image-pull-after-disable-frontier-20260708\"]}"}
```

Interpretation:
- the current offender set is three **other** waits;
- `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708` is **not** in the current offender set because this task is active and covers it.

### Persisted metric row

Current runtime metric row for `aks-rp-e2e.process.blocked.overdue-unworked-count` now shows:

- `current = 3`
- `updated_at = 1783584868721`
- `updated_ts = 2026-07-09 08:14:28 UTC`

That persisted sample agrees with the fresh recompute that the metric family is currently red for unrelated waits, not for the jwt shared wait while this task is active.

## Recommended exact coverage/watch state

Because worker mode does not allow planner/tree mutation here, the exact recommended outcome is:

1. **Keep** `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708` as the canonical shared blocked holder.
2. **Treat `ops-refresh-overdue-jwt-shared-wait-coverage-20260709b` as the current active overdue-coverage surface** for that wait until a sharper returned/declined/reroute outcome exists.
3. **Do not rely on the finished alert-3249 task for coverage anymore.** It is historical evidence only.
4. **Refresh the wait’s watch window on the same lineage** at the next planner/app-ops pass, because the currently recorded `next_check_at` is already stale. The refreshed watch should remain on the same shared wait and preserve the same bounded return contract rather than reopening an unchanged rerun.
5. Replace the current coverage surface only if one of these sharper outcomes actually lands:
   - a reviewed returned owner reply,
   - authoritative no-surface proof, or
   - an exact reroute naming the replacement owner/surface.

## Bottom line

- Latest fresh evidence is still **send proof**, not **returned proof**.
- The second-contact packet from `2026-07-09` is the freshest exact owner-action lineage.
- No returned owner/operator signal is visible yet.
- Therefore `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708` remains the smallest truthful shared holder.
- **Self-excluded baseline:** without `ops-refresh-overdue-jwt-shared-wait-coverage-20260709b`, the jwt shared wait would still be an overdue-unworked contributor.
- **Current represented set:** with this task active, the jwt shared wait is covered, and the current overdue-unworked offender set has moved to three unrelated waits.