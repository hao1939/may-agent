# ops-link-dev-infra-overdue-wait-to-active-recovery-metric-20260709

- Task: `ops-link-dev-infra-overdue-wait-to-active-recovery-metric-20260709`
- Reviewed at: `2026-07-09T18:00Z`
- Metric family:
  - `aks-rp-e2e.process.blocked.overdue-unworked-count`
  - `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count`
- Exact historical offender under review: `wait-dev-infra-core-ado-run-171501538-result-20260709`
- Exact recovery lineage under review:
  - `recover-dev-infra-core-ado-run-171501538-status-or-escalation-20260709`
  - current exact successor: `repair-spec-kms-v2plus-enable-pmk-from-v2-public-https-keyid-and-rerun-20260709`

## Result

This metric issue is now **truthfully cleared** in current tree state.

At audit start, the known problem was real: the overdue blocked-wait metric had been counting `wait-dev-infra-core-ado-run-171501538-result-20260709` even though an exact recovery task already existed.

After the recovery/review flow completed, the stale wait is no longer live overdue blocked debt:

- `wait-dev-infra-core-ado-run-171501538-result-20260709` is now `done`, not `blocked`;
- `recover-dev-infra-core-ado-run-171501538-status-or-escalation-20260709` is now `done` and explicitly names the blocked wait id in its goal text;
- the branch now has one exact active bounded successor instead of a passive overdue wait:
  - `repair-spec-kms-v2plus-enable-pmk-from-v2-public-https-keyid-and-rerun-20260709` (`active`).

A fresh recompute now shows both overdue metrics at `0` for this cause.

## Exact metric rule that originally caused the false-looking count

The current sampler logic in `scripts/project-metrics.ts` and the parallel watchdog helper only suppress an overdue blocked wait when another `active` or `review` task covers it by one of two recognized mechanisms:

1. the candidate task's searchable text explicitly contains the blocked wait id; or
2. the candidate task carries a recognized `ops:blocked-overdue:<scope>` conflict scope, where `<scope>` is derived only from these parent buckets:
   - `project` -> `ops:blocked-overdue:project`
   - `aks-spec-verification-loop` -> `ops:blocked-overdue:spec-loop`
   - `aks-feature-compact-loop` -> `ops:blocked-overdue:compact-loop`

That rule is implemented by:

- `blockedOverdueScope(...)`
- `taskCoversBlockedOverdueWait(...)`

Because `wait-dev-infra-core-ado-run-171501538-result-20260709` lived under parent `focus-dev-infra-core-live-pass-20260707`, it did **not** map to a recognized blocked-overdue scope bucket. So the only available recognition path for this wait family was the explicit wait-id text match.

## Pre-audit contributor set, excluding this audit task itself

Per the blocked-overdue audit contract, baseline is computed as though this audit task does not exist.

At the time captured by the prior verification evidence, the pre-audit contributor set was:

- `wait-dev-infra-core-ado-run-171501538-result-20260709`

Why it counted then:

- the wait was still `blocked` with past-due watch times;
- its parent was a focus branch, so no recognized `ops:blocked-overdue:<scope>` bucket existed for it;
- the already-existing recovery task had not yet completed the branch transition that removed the stale wait from live blocked state.

## Smallest truthful repair that actually resolved the cause

The smallest truthful repair was **not** a generic new blocker and did **not** require inventing a new broad metric scope.

Instead, the existing exact recovery completed the branch transition:

1. reviewed Azure DevOps run `171501538` to terminal artifact-backed truth;
2. proved the old ADO-result wait should no longer remain as a passive overdue blocked leaf;
3. marked `wait-dev-infra-core-ado-run-171501538-result-20260709` `done` with review summary:
   - `Run 171501538 is no longer an overdue passive wait: the accepted review downloaded returned artifacts, proved the run terminal, and replaced this stale ADO wait with exact follow-up repair-spec-kms-v2plus-enable-pmk-from-v2-public-https-keyid-and-rerun-20260709.`
4. left one exact active successor:
   - `repair-spec-kms-v2plus-enable-pmk-from-v2-public-https-keyid-and-rerun-20260709`

That is the smallest truthful fix because the problem was no longer “missing active recovery linkage”; it was “stale wait should stop existing as an overdue blocked holder once the run is terminal and the exact failing spec is known.”

## Fresh measurement cycles

Fresh local recomputes now return zero for both metrics:

### Canonical metric

```json
{"measuredAt":1783590728472,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

### Compatibility alias metric

```json
{"measuredAt":1783590706099,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[],\"compatibilityAliasFor\":\"aks-rp-e2e.process.blocked.overdue-unworked-count\"}"}
```

## Current represented set

Current exact represented state for this family is:

- terminal ADO run review is complete;
- stale wait holder is retired from blocked state;
- one exact active repair leaf remains:
  - `repair-spec-kms-v2plus-enable-pmk-from-v2-public-https-keyid-and-rerun-20260709`

So the post-action represented set for the formerly overdue wait is effectively:

- **no live overdue blocked wait contributors** for this cause;
- **one active exact domain repair** for the single failing spec.

## Conclusion

Acceptance is satisfied in current runtime state:

- the evidence names the exact metric rule that originally counted the dev-infra-core wait;
- the tree was repaired in the smallest truthful way by retiring the stale wait and replacing it with one exact active repair successor;
- after fresh recompute, both overdue metrics are now `0` for this cause;
- no duplicate generic blocker task was needed or created.

## Planner note

No further planner repair is needed for this specific metric cause unless the exact active KMS repair later stalls and creates a new overdue blocked wait. The useful next review surface is the existing active domain repair leaf, not another app-ops blocked-overdue linkage task.
