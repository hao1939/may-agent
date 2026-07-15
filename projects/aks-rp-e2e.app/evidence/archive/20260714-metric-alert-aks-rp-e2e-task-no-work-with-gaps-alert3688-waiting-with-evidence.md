# Metric alert triage — waiting_with_evidence — `aks-rp-e2e.task.no-work-with-gaps`

- Alert id: `3688`
- Metric id: `aks-rp-e2e.task.no-work-with-gaps`
- Triage time: `2026-07-14T16:23Z`
- Owner: `app-ops`

## Judgment

Choose `waiting_with_evidence` because the persisted breach was real when sampled, but the live task tree had already recovered by the time this triage rechecked the source metric. The only remaining gap is runtime metric/alert catch-up.

The persisted runtime state is still breaching:

- `metrics.current = 1` for `aks-rp-e2e.task.no-work-with-gaps`
- open alert row `3688` still has `resolved_at = NULL`
- latest persisted snapshot is `value = 1` at `1784048224031`

But the live source command is now healthy:

- `bun run ./scripts/project-metrics.ts aks-rp-e2e.task.no-work-with-gaps --json` returned `{"value":0}`
- `bun run task-tree summary --json` shows one active frontier leaf: `ops/recheck-focus-terminal-frontier-readout-post-dismissal-20260714`
- that leaf was created and assigned after the breach event, at `2026-07-14T16:57:27Z`, which explains why the current live tree no longer matches the persisted `1`

## Evidence checked

1. **Persisted metric row still breaching**
   - `SELECT id, current, updated_at FROM metrics WHERE id = 'aks-rp-e2e.task.no-work-with-gaps'`
   - observed `current=1`, `updated_at=1784048224031`

2. **Alert row still open**
   - `SELECT id, resolved_at, created_at FROM metric_alerts WHERE id = 3688`
   - observed `resolved_at=NULL`

3. **Latest persisted snapshots show the current open `1` sample**
   - `SELECT value, measured_at, measured_by FROM metric_snapshots WHERE metric_id = 'aks-rp-e2e.task.no-work-with-gaps' ORDER BY measured_at DESC LIMIT 3`
   - observed latest values `1, 0, 0`

4. **The breach event fired before the recovery task was assigned**
   - `events` query shows `metric.breach` for this metric at `1784048272727`
   - the same query shows `project.task.assigned` for `ops/recheck-focus-terminal-frontier-readout-post-dismissal-20260714` at `1784048298389`
   - this ordering matches a real transient no-work frontier that was later repaired

5. **Live task tree is now recovered**
   - `bun run task-tree summary --json` shows `frontier.active = ["ops/recheck-focus-terminal-frontier-readout-post-dismissal-20260714"]`
   - `bun run task-tree show ops/recheck-focus-terminal-frontier-readout-post-dismissal-20260714` shows state `active`, owner `app-ops`, assigned by planner at `2026-07-14T16:57:27.256Z`
   - `bun run ./scripts/project-metrics.ts aks-rp-e2e.task.no-work-with-gaps --json` now returns `{"value":0}`

6. **Why the persisted `1` was plausible**
   - `bun run task-tree show ops/apply-focus-terminal-frontier-context-readout-patch-20260714` shows that task already sat in `review`
   - `bun run task-tree show ops-apply-ops-apply-close-stale-nonapproval-escalation-envelopes-after-r` also shows `review`
   - the metric contract explicitly says review leaves do not suppress `no-work-with-gaps`, so a review-only frontier before the new active assignment would correctly sample as `1`

## Why this is not another operation

- Not `fix_root_cause`: the live recovery already exists in the task tree; this triage did not need another safe tree mutation to restore executable work.
- Not `resolve_stale`: the alert row is stale **now**, but the evidence indicates the sampled `1` was real before the planner assigned the new active leaf.
- Not `calibrate_metric` or `downgrade_priority`: the metric contract still matches the intended P0 zero-executable-work condition while verification gaps remain.
- Not `upgrade_or_escalate`: there is already a safe owner-side recovery path in motion and the live source metric has recovered.

## Next validation

Wait for the next `metrics-snapshot` / alert-recovery pass.

Expected result:

- persisted `metrics.current` for `aks-rp-e2e.task.no-work-with-gaps` moves from `1` to `0`
- alert `3688` resolves automatically

If the next snapshot still persists `1` while the source command still returns `0`, re-triage as a metric state-sync defect rather than a real no-work frontier breach.
