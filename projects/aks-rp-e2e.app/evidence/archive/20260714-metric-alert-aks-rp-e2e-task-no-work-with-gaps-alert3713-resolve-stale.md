# Metric alert triage — resolve_stale — `aks-rp-e2e.task.no-work-with-gaps`

- Alert id: `3713`
- Metric id: `aks-rp-e2e.task.no-work-with-gaps`
- Triage time: `2026-07-14T19:36Z`
- Owner: `app-ops`
- Chosen operation: `resolve_stale`

## Judgment

Choose `resolve_stale` because the alert delivered to this triage was already recovered by the time owner judgment completed.

The current runtime state is healthy again:

- the persisted metric row is back in range with `current=0`
- alert row `3713` already has a non-null `resolved_at`
- the owner-side source recompute also returns `value=0`
- the task tree currently has three active frontier leaves, so this is not a real no-work condition anymore even though verification gaps still remain

This means the alert packet was stale at judgment time, not that the metric contract is wrong.

## Evidence checked

1. **Persisted metric row recovered**
   - Query: `SELECT id, current, threshold, target, priority, updated_at FROM metrics WHERE id = 'aks-rp-e2e.task.no-work-with-gaps'`
   - Observed: `current=0`, `threshold=0`, `priority=P0`, `updated_at=1784057549205`

2. **Alert row already resolved**
   - Query: `SELECT id, metric_id, alert_type, resolved_at, created_at FROM metric_alerts WHERE id = 3713`
   - Observed: `resolved_at=1784057613810`, `created_at=1784057310450`

3. **Recent snapshots show a transient breach that already self-cleared**
   - Query: `SELECT value, measured_at, measured_by FROM metric_snapshots WHERE metric_id = 'aks-rp-e2e.task.no-work-with-gaps' ORDER BY measured_at DESC LIMIT 10`
   - Observed latest values: `0 @ 1784057549205`, `1 @ 1784057249225`, then earlier samples all `0`
   - Interpretation: the breach lasted for one sample interval and then cleared on the next snapshot

4. **Owner-side source metric agrees with recovery**
   - Command: `bun run ./scripts/project-metrics.ts aks-rp-e2e.task.no-work-with-gaps --json`
   - Observed: `{"measuredAt":1784057790145,"value":0}`

5. **Verification gaps still remain, but executable work exists now**
   - Command: `bun run ./scripts/project-metrics.ts aks-rp-e2e.spec.unverified-count --json`
   - Observed: `{"measuredAt":1784057789944,"value":90}`
   - Command: `bun run task-tree summary --json`
   - Observed active frontier leaves:
     - `domain/vmpr-mounted-source-parity-sweep-20260714`
     - `ops/diagnose-shared-github-auth-preflight-family-local-recovery-20260714`
     - `ops/repair-overdue-blocked-metric-active-shared-auth-family-20260714`
   - Interpretation: gaps remain, but the project is not starved; active work is already in flight

## Why this is not another operation

- Not `fix_root_cause`: no further owner-side repair was needed during this triage because the project already had active executable work and the metric had already recovered.
- Not `waiting_with_evidence`: the alert is no longer merely waiting for recovery; the persisted alert row is already resolved.
- Not `calibrate_metric` or `downgrade_priority`: this judgment is about alert `3713`, and the current evidence only proves that this specific alert has already self-cleared.
- Not `upgrade_or_escalate`: there is no remaining unsafe or unresolved incident at judgment time.

## Next validation

Watch the next `metrics-snapshot` and confirm the metric remains `0` while the task tree continues to show active or runnable work whenever verification gaps remain.
