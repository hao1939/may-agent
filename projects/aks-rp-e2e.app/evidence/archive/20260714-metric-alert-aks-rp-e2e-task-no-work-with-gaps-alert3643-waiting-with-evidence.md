# Metric alert triage — waiting_with_evidence — `aks-rp-e2e.task.no-work-with-gaps`

- Alert id: `3643`
- Metric id: `aks-rp-e2e.task.no-work-with-gaps`
- Triage time: `2026-07-14T10:33Z`
- Owner: `app-ops`

## Judgment

Choose `waiting_with_evidence` because the breach was real at the last persisted sample, but the live task tree already recovered before this triage completed and the remaining gap is only runtime metric/alert catch-up.

At `2026-07-14T10:31:55Z`, `task-tree summary --json` showed a blocked-only frontier with `active_task_ids: []` and `bun run ./scripts/project-metrics.ts aks-rp-e2e.task.no-work-with-gaps --json` returned `{"value":1}`. That matches the open alert row and the persisted metric row still stored as `current=1`.

By `2026-07-14T10:32:54Z`, the planner had created and assigned one concrete app-ops recovery leaf: `ops/reconcile-spec-loop-terminal-frontier-model-finality-20260714`. A fresh live recompute at `2026-07-14T10:33:16Z` now returns `{"value":0}` and `task-tree summary --json` now shows that recovery leaf in `frontier.active`.

## Evidence checked

1. Persisted metric state is still breaching:
   - `SELECT id, current, updated_at FROM metrics WHERE id = 'aks-rp-e2e.task.no-work-with-gaps'`
   - observed `current=1`, `updated_at=1784025094075`
2. Alert row is still open:
   - `SELECT id, resolved_at, created_at FROM metric_alerts WHERE id = 3643`
   - observed `resolved_at=NULL`
3. Latest persisted snapshots show intermittent real blocked-only drops, including the current one:
   - `SELECT value, measured_at, measured_by FROM metric_snapshots WHERE metric_id = 'aks-rp-e2e.task.no-work-with-gaps' ORDER BY measured_at DESC LIMIT 10`
   - latest values: `1,0,0,1,0,0,1,0,0,0`
4. Breach was real at sample time:
   - `bun run task-tree summary --json` at `2026-07-14T10:31:55Z` showed `active_task_ids: []`, no runnable/waiting/review frontier, and only blocked leaves
   - `bun run ./scripts/project-metrics.ts aks-rp-e2e.task.no-work-with-gaps --json` at `2026-07-14T10:32:47Z` returned `{"value":1}`
5. Live task tree is now recovered:
   - `bun run task-tree show ops/reconcile-spec-loop-terminal-frontier-model-finality-20260714` shows state `active`, assigned by planner at `2026-07-14T10:32:54.412Z`
   - `bun run task-tree summary --json` at `2026-07-14T10:33:10Z` shows `frontier.active: ["ops/reconcile-spec-loop-terminal-frontier-model-finality-20260714"]`
   - `bun run ./scripts/project-metrics.ts aks-rp-e2e.task.no-work-with-gaps --json` at `2026-07-14T10:33:16Z` returns `{"value":0}`

## Why this is not another operation

- Not `fix_root_cause`: the concrete repair already happened in live task-tree state during the alert window via planner creation of the active recovery leaf; no additional safe tree mutation was required from this triage session.
- Not `resolve_stale`: the alert is not invalid; the `1` sample was real when recorded.
- Not `calibrate_metric` or `downgrade_priority`: the metric is correctly signaling a true zero-work frontier and should remain P0.
- Not `upgrade_or_escalate`: a safe recovery path already exists and has already been applied.

## Next validation

Wait for the next `metrics-snapshot` / alert-recovery pass. Expected result:

- persisted metric row for `aks-rp-e2e.task.no-work-with-gaps` moves from `current=1` to `current=0`
- alert `3643` recovers naturally

If the next snapshot still persists `1` while the source command still returns `0`, re-triage as a metric state-sync defect rather than a real no-work frontier breach.
