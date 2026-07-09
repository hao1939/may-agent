# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 3222)

- Alert id: `3222`
- Metric id: `aks-rp-e2e.process.unpublished-change-count`
- Judged at: `2026-07-09T11:29:00Z`
- Chosen operation: `fix_root_cause`

## Current measurement

Fresh checks during this triage show the alert is still real:

- runtime metric row says `current=11`, `threshold=0`, `target=0`, `priority=P0`
- direct recompute from `/app/projects/aks-rp-e2e.app` via `bun scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count --json` returned `value=11`
- `git status --short --branch` in `/app/projects/aks-rp-e2e` shows exactly 11 tracked modified files

Those 11 files currently split into four families:

1. `fleet` compact/spec/test files — already represented by blocked holder `hold-compact-fleet-hubless-rpapi-version-progression-frontier-20260709`
2. `traffic-applink` compact files — already represented by accepted checkpoint audit `ops-checkpoint-traffic-applink-compact-slice-after-two-cluster-frontier-20260709c`, which proved publication is still correctly held behind the exact upgrade-survival frontier
3. `network-cni` row-191 spec/test files — already represented by the accepted row-191 review plus retry checkpoint blocker note
4. `model/knowledge-map/model.json` — previously still part of the red metric surface, but without its own explicit checkpoint owner after the row-191 retry proved it had separated into a single-file `candidate` slice

## Root cause repaired in this triage

The repeated breach was no longer just "dirty repo"; it included a **process-closure gap**:

- the bounded retry checkpoint note for row 191 proved the three-file residue had split into:
  - a held `feature:network-cni` pair, and
  - a separate single-file `candidate` slice for `model/knowledge-map/model.json`
- but the runtime task tree still had no explicit live checkpoint task for that model-only slice

That meant part of the red unpublished-change surface remained real but not yet routed to its smallest truthful next action.

## Concrete state change made

I repaired that task-tree gap by adding a new exact backlog leaf in the live app task tree:

- task id: `checkpoint-unpublished-model-knowledge-map-row191-slice-20260709`
- parent: `project`
- owner: `aks-explorer`
- scope: only `model/knowledge-map/model.json`

Goal of the new task:

> Checkpoint the exact accepted model/knowledge-map row-191 residue as one bounded unpublished slice by publishing only `model/knowledge-map/model.json`, using the accepted run-171523370 row-191 pass review and retry checkpoint blocker note as authority, without mixing Fleet, traffic-applink, or held network-cni files.

This is a root-cause fix in app-ops scope because it converts the last unrepresented residue in the metric surface into one exact next action instead of leaving it as generic unpublished churn.

## Why this is `fix_root_cause`

I did not recalibrate or downgrade the metric because the count is still accurate.
I did not resolve it as stale because the recompute still returns `11`.
I did not leave it as pure waiting because app-ops could safely improve the process state now.

The safe fix available to app-ops was to repair the process representation gap so every remaining unpublished file family has an exact visible owner path:

- Fleet: exact blocked holder already exists
- traffic-applink: exact blocked/accepted checkpoint reasoning already exists
- network-cni spec/test pair: exact held row-191 blocker already exists
- model knowledge-map residue: **new exact checkpoint leaf added by this triage**

## Next validation

Validate on the next `metrics-snapshot`, or sooner after `checkpoint-unpublished-model-knowledge-map-row191-slice-20260709` either publishes `model/knowledge-map/model.json` or records an exact single-file blocker.