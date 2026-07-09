# ops-verify-overdue-nonhuman-wait-metric-after-westus2-repair-20260709

- Task: `ops-verify-overdue-nonhuman-wait-metric-after-westus2-repair-20260709`
- Reviewed at: `2026-07-09T18:00:05Z`
- Metric: `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count`
- Goal: verify the metric after the westus2 capacity family wait repair, and if still nonzero, name the exact remaining counted wait plus the precise repair already representing it.

## Result

The westus2 capacity holder repair **did remove the westus2 family from the overdue metric**, but the metric **did not clear to 0**.

After two fresh local measurement cycles, the exact remaining offender is:

- `wait-dev-infra-core-ado-run-171501538-result-20260709`

So the truthful current state is:

- **westus2 repair outcome:** successful for the intended holder; it is no longer counted.
- **metric outcome:** still `1`, explained by one unrelated overdue blocked wait in the dev-infra-core branch.
- **exact linked repair already in tree:** `recover-dev-infra-core-ado-run-171501538-status-or-escalation-20260709`

## Fresh measurements

Two consecutive local recomputes after the westus2 repair returned the same result:

```json
{"measuredAt":1783590266606,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1,"sampleSize":1,"note":"{\"offenderTaskIds\":[\"wait-dev-infra-core-ado-run-171501538-result-20260709\"],\"compatibilityAliasFor\":\"aks-rp-e2e.process.blocked.overdue-unworked-count\"}"}
```

```json
{"measuredAt":1783590271510,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1,"sampleSize":1,"note":"{\"offenderTaskIds\":[\"wait-dev-infra-core-ado-run-171501538-result-20260709\"],\"compatibilityAliasFor\":\"aks-rp-e2e.process.blocked.overdue-unworked-count\"}"}
```

The persisted metric rows also match that live state:

- `aks-rp-e2e.process.blocked.overdue-unworked-count = 1`
- `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count = 1`

## Why the westus2 wait is no longer counted

The accepted repair task `ops-repair-westus2-capacity-family-stale-waiting-for-20260709` removed stale nested `waiting_for` run metadata from `wait-shared-westus2-managed-cluster-capacity-family-return-20260703` and refreshed the blocker contract.

Current live westus2 holder facts:

- task id: `wait-shared-westus2-managed-cluster-capacity-family-return-20260703`
- state: `blocked`
- parent: `project`
- blocker `resume_at`: `2026-07-10T18:00:00Z`
- blocker `next_check_at`: `2026-07-10T18:00:00Z`
- blocker `fallback_at`: `2026-07-11T18:00:00Z`
- blocker `waiting_for.type`: `azure.capacity.available`
- blocker `waiting_for.taskId`: `wait-shared-westus2-managed-cluster-capacity-family-return-20260703`
- stale `waiting_for.runId` / `sourceRunId=28676489009`: removed

Under `scripts/project-metrics.ts`, a blocked leaf is only overdue when its `resume_at` or `fallback_at` is already in the past. The westus2 holder now has future watch times, so it is **not** a current overdue-unworked contributor.

## Self-excluded baseline for this audit task

Per the overdue-audit rule, compute the baseline as if this verification task did not exist.

That baseline is unchanged from the live result, because this verification task does **not** cover the remaining wait under current metric rules:

- the active verification task does **not** explicitly name `wait-dev-infra-core-ado-run-171501538-result-20260709`; and
- its conflict scope `ops:blocked-overdue-nonhuman-unworked-metric` is **not** one of the metric-recognized coverage scopes (`ops:blocked-overdue:project`, `ops:blocked-overdue:spec-loop`, `ops:blocked-overdue:compact-loop`).

So the pre-audit contributor set is exactly:

- `wait-dev-infra-core-ado-run-171501538-result-20260709`

## Exact still-counted wait and why it remains overdue/unworked

### Counted wait

- task id: `wait-dev-infra-core-ado-run-171501538-result-20260709`
- state: `blocked`
- parent: `focus-dev-infra-core-live-pass-20260707`
- owner: `aks-explorer`
- goal: wait for Azure DevOps run `171501538`

### Why it is overdue

Current blocker facts on the wait:

- `next_check_at = 2026-07-09T05:31:00Z`
- `fallback_at = 2026-07-09T09:31:00Z`
- no current `resume_at`

The metric logic uses `resume_at` and `fallback_at` as overdue watch times. Because `fallback_at` is already in the past, this blocked leaf is currently overdue.

### Why it is still counted as unworked

The tree already contains one exact active follow-up:

- `recover-dev-infra-core-ado-run-171501538-status-or-escalation-20260709`
- state: `active`
- owner: `aks-explorer`
- goal: check overdue ADO run `171501538` and turn the stale passive wait into fresh state

However, this active repair does **not** satisfy the metric’s current coverage rules for the blocked wait, because:

1. its searchable task text does **not** explicitly contain the blocked wait id `wait-dev-infra-core-ado-run-171501538-result-20260709`; and
2. its conflict scopes are only:
   - `focus:dev-infra-core`
   - `ado-run:171501538`

The coverage helper in `scripts/project-metrics.ts` only recognizes either:

- explicit mention of the blocked wait id in active/review task text, or
- a matching `ops:blocked-overdue:<scope>` scope.

Also, this wait lives under parent `focus-dev-infra-core-live-pass-20260707`, which is **not** one of the three scope buckets (`project`, `aks-spec-verification-loop`, `aks-feature-compact-loop`) that the helper can map to a recognized `ops:blocked-overdue:*` scope.

So the active dev-infra-core recovery task is a real follow-up, but it is **not yet linked in the way the metric sampler recognizes**.

## Exact repair already linked in tree

The task tree already contains one precise repair for this cause:

- `recover-dev-infra-core-ado-run-171501538-status-or-escalation-20260709`

That means the alert is **explained**, not mysterious. The remaining gap is metric-recognized linkage, not missing process ownership.

## Planner/app-ops review output

Worker mode does not mutate the task tree from this session.

Planner should use the already-active `recover-dev-infra-core-ado-run-171501538-status-or-escalation-20260709` as the exact follow-up repair for the remaining offender and then make one precise linkage repair so the overdue metric truthfully clears when coverage exists. The smallest truthful planner-side repair is one of:

1. refresh/replace `wait-dev-infra-core-ado-run-171501538-result-20260709` so it is no longer overdue if current run state makes the old fallback stale, or
2. update the active recovery task so it explicitly names `wait-dev-infra-core-ado-run-171501538-result-20260709` in metric-searchable text, or
3. replace the pair with one exact carrier whose active/review representation satisfies the current metric coverage rule.

No new generic blocker task is warranted; the exact offender and the exact existing follow-up are already known.

## Bottom line

- The westus2 capacity family repair worked for its intended metric effect: `wait-shared-westus2-managed-cluster-capacity-family-return-20260703` is no longer counted as overdue/unworked.
- The metric remains at `1` for an unrelated reason: `wait-dev-infra-core-ado-run-171501538-result-20260709`.
- The tree already has one exact repair for that cause: `recover-dev-infra-core-ado-run-171501538-status-or-escalation-20260709`.
- The remaining process issue is that this active repair is **not yet linked in a way the metric sampler recognizes**, so the count stays nonzero until planner refreshes the wait or tightens that linkage.