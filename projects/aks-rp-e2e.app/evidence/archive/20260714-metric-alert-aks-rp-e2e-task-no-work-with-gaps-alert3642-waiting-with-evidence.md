# Metric alert triage — waiting_with_evidence — `aks-rp-e2e.task.no-work-with-gaps`

- Alert id: `3642`
- Metric id: `aks-rp-e2e.task.no-work-with-gaps`
- Triage time: `2026-07-14T10:18Z`
- Owner: `app-ops`

## Judgment

Choose `waiting_with_evidence` because the persisted runtime metric row still shows `current=1`, but the live owner-side source command now recomputes the metric as `0` after the planner restored one concrete active domain leaf.

The breach was real briefly: `task-tree summary` at `2026-07-14T10:16:31Z` showed a blocked-only frontier with no runnable, waiting, active, or review leaves, and `bun run ./scripts/project-metrics.ts aks-rp-e2e.task.no-work-with-gaps --json` returned `value=1`.

The root cause is already repaired in live task-tree state: by `2026-07-14T10:17:29Z`, the planner had created and assigned `domain/sweep-vmpr-post-parity-residual-references-20260714`, and a fresh owner-side metric recompute returned `value=0`.

## Evidence checked

1. Persisted runtime metric state still breaching:
   - `SELECT id, current, updated_at FROM metrics WHERE id = 'aks-rp-e2e.task.no-work-with-gaps'`
   - observed `current=1`, `updated_at=1784024147039`
2. Open alert row is still unresolved:
   - `SELECT id, resolved_at, created_at FROM metric_alerts WHERE id = 3642`
   - observed `resolved_at=NULL`
3. Breach was real at sample time:
   - `bun run task-tree summary --json` at `2026-07-14T10:16:31Z` showed `active_task_ids: []` and no runnable/waiting/review frontier
   - `bun run ./scripts/project-metrics.ts aks-rp-e2e.task.no-work-with-gaps --json` at `2026-07-14T10:17:16Z` returned `{"value":1}`
4. Live tree is now recovered:
   - `bun run task-tree show domain/sweep-vmpr-post-parity-residual-references-20260714` shows state `active`, assigned at `2026-07-14T10:17:29.723Z`
   - `bun run task-tree summary --json` now shows `active_task_ids: ["domain/sweep-vmpr-post-parity-residual-references-20260714"]`
   - `bun run ./scripts/project-metrics.ts aks-rp-e2e.task.no-work-with-gaps --json` now returns `{"value":0}`

## Why this is not another operation

- Not `fix_root_cause`: the concrete repair already happened through planner/task-tree movement during this triage window; no additional safe tree mutation was needed from this session.
- Not `resolve_stale`: the alert should recover naturally after the next runtime metrics refresh updates the persisted metric row from `1` to `0`.
- Not `calibrate_metric` or `downgrade_priority`: the metric contract is still correct for a true zero-work frontier.

## Next validation

Wait for the next `metrics-snapshot` / alert-recovery pass. Expected result:

- persisted metric row for `aks-rp-e2e.task.no-work-with-gaps` moves from `current=1` to `current=0`
- alert `3642` recovers naturally

If the next snapshot still persists `1` while the source command still returns `0`, re-triage as a metric state-sync defect rather than a real no-work frontier breach.
