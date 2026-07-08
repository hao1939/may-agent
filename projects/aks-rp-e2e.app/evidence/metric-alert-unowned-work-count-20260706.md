# Metric alert triage — aks-rp-e2e.process.unowned-work-count

- Alert id: `2791`
- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Judged at: `2026-07-06T23:10:00Z`
- Chosen operation: `waiting_with_evidence`

## Current measurement

Open alert payload and latest snapshot agree the metric is still breaching now:

- metric current: `1`
- threshold / target: `0`
- latest snapshot time: `2026-07-06T22:58:20.201Z`
- snapshot contributors:
  - `recoveryUnownedSpecIds=["spec.bootstrap-profile-byo-acr.cache-direct-cache-switch"]`

This is a **real current breach**, not a stale recovered alert.

## Exact contributing mismatch

### spec.bootstrap-profile-byo-acr.cache-direct-cache-switch is recovery-unowned in controller-visible linkage

Current spec-loop runtime state still points `spec.bootstrap-profile-byo-acr.cache-direct-cache-switch` at a task id that is not present in the current task tree:

- state `taskId`: `hold-spec-loop-bootstrap-profile-byo-acr-contradiction-timeout-frontier-20260706b`
- state `status`: `pending`
- state `lastRunId`: `28654790934`
- state `review.classification`: `authoritative_source_vs_live_behavior_contradiction_then_timeout_family`
- state `successorEvidencePath`: `/app/projects/aks-rp-e2e/evidence/archive/review-bootstrap-profile-terminal-runs-cross-loop-20260706.md`

But the current task tree only contains the older exact holder:

- task tree holder: `hold-spec-loop-pending-bootstrap-profile-byo-acr-contradiction-20260704`
- state: `blocked`
- owner: `aks-explorer`
- blocker text still references only the earlier contradiction run `28654790934`

So the work is **not actually ownerless in project intent**, but it **is ownerless in controller-visible linkage**, which is exactly what this metric is supposed to catch.

## Why this breach is real

The accepted cross-loop review for this same spec family says the owner should restore exact blocked holders with a shared contradiction-then-timeout story:

- preserve `28654790934` as the earlier contradiction proof
- preserve `28666029233` as the later post-repair timeout frontier
- do not request an unchanged rerun from either terminal artifact alone

However, current runtime state and current task-tree state are out of sync:

- spec-loop runtime state has already moved to the newer holder id `hold-spec-loop-bootstrap-profile-byo-acr-contradiction-timeout-frontier-20260706b`
- current `tasks/tree.json` does **not** contain that holder id
- current `tasks/tree.json` still contains only the older holder `hold-spec-loop-pending-bootstrap-profile-byo-acr-contradiction-20260704`

That makes this a genuine runtime-accountability mismatch, not metric noise.

## Judgment

The breach is real, but the safe next step is to **wait on the already active owner/planner reconciliation path**, not manually rewrite runtime controller state from alert triage.

Why:

1. the contributing record lives in runtime-owned loop state (`.state/spec-loop/state.json`),
2. the mismatch is a holder-replacement drift between accepted evidence and current task-tree representation,
3. there is already an active planner wake for `aks-explorer` immediately after the alert, and
4. ad hoc triage edits to runtime/task linkage would bypass the project's existing planner/controller ownership path.

## Why `waiting_with_evidence`

`waiting_with_evidence` is the truthful operation because:

- the alert is real and should stay visible;
- the exact contributor is now narrowed to one spec id and one mismatched holder id;
- the evidence note now records the current controller-visible mismatch and the accepted contradiction-to-timeout family story;
- the next honest validation is the next `metrics-snapshot`, after planner/controller state converges.

## Next validation signal

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unowned-work-count` after the planner/controller path either:

- restores a task-tree holder matching `hold-spec-loop-bootstrap-profile-byo-acr-contradiction-timeout-frontier-20260706b`, or
- rewrites `.state/spec-loop/state.json` so `spec.bootstrap-profile-byo-acr.cache-direct-cache-switch` points at the still-existing exact holder in `tasks/tree.json`.
