# Metric alert triage — fix_root_cause — `aks-rp-e2e.task.no-work-with-gaps`

- Alert id: `3700`
- Metric id: `aks-rp-e2e.task.no-work-with-gaps`
- Triaged at: `2026-07-14T18:00:00Z`
- Chosen operation: `fix_root_cause`

## Judgment

The breach was real at `2026-07-14T17:57Z`: the live task tree had `0` runnable, `0` active, `0` review, and `124` blocked leaves while verification gaps still remained (`spec.unverified-count=90`, `model.unknown-path-count=62`).

The concrete repair is to restore executable process work instead of leaving a blocked-only frontier. During triage, the project regained executable work in two visible ways:

1. the planner activated `ops/repair-no-executable-work-with-gaps-20260714`, and
2. I added runnable follow-up leaf `ops/review-blocked-only-frontier-and-seed-local-followup-alert3700-20260714` so the blocked-only state cannot remain invisible.

A fresh owner-side recompute now returns `0`, so this alert should recover on the next metrics snapshot without manual DB edits.

## Evidence checked

### 1) Breach was real at investigation time

Before repair, the live summary showed:

- `active_task_ids: []`
- `runnable: []`
- `active: []`
- `review: []`
- `blocked: 124`

And the owner-side metric command returned:

```json
{"value":1}
```

Supporting gap signals at the same point:

- `spec-unverified=90`
- `unknown=62`

### 2) Executable work was restored

The task tree now shows:

- active leaf: `ops/repair-no-executable-work-with-gaps-20260714`
- runnable leaf: `ops/review-blocked-only-frontier-and-seed-local-followup-alert3700-20260714`

The new runnable review leaf was added under `project` with goal:

> Review the current blocked-only project frontier that triggered alert 3700 and restore executable work without broadening into blind reruns.

The active sibling repair leaf is already assigned with current attempt/session metadata:

- attempt: `a_ops_repair-no-executable-work-with-gaps-20260714_20260714180001`
- session: `s_task_ops_repair-no-executable-work-with-gaps-20260714`
- worker started at: `2026-07-14T18:00:17.771Z`

### 3) Metric recompute is now healthy

Fresh owner-side recompute after the repair:

```json
{"value":0}
```

Current supporting process counts:

- `ready=1`
- `active=1`
- `blocked=123`
- `spec-unverified=90`
- `unknown=62`

That means verification gaps still remain, but the project no longer has zero executable work.

## Why this is not another operation

- Not `waiting_with_evidence`: the breach was real and executable work has now been restored.
- Not `resolve_stale`: the persisted alert row may still be open until the next snapshot, but the underlying process state has been repaired rather than merely declared stale.
- Not `calibrate_metric` or `downgrade_priority`: this remains a valid P0 signal when the frontier truly collapses to zero executable work.
- Not `upgrade_or_escalate`: no destructive action or human-only policy decision was required.

## Next validation

Wait for the next `metrics-snapshot` / alert-recovery pass. Expected validation:

- persisted `metrics.current` for `aks-rp-e2e.task.no-work-with-gaps` moves from `1` to `0`
- alert `3700` gains `resolved_at`
