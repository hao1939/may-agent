# Metric alert triage — waiting_with_evidence — `aks-rp-e2e.task.stale-active-with-gaps`

Date: 2026-07-14T05:22Z  
Alert id: `3594`  
Metric id: `aks-rp-e2e.task.stale-active-with-gaps`

## Judgment

Choose `waiting_with_evidence` because the persisted runtime metric row and open alert still show a breach (`current=1` at `2026-07-14T05:19:43Z`), but a fresh owner-side recompute now returns `0` and the current health snapshot reports `staleActiveTaskIds: []`. There is no current stale active leaf for app-ops to repair safely in this session, so the only truthful action is to document the now-healthy live source state and wait for the next normal metric snapshot / alert-recovery cycle to catch up.

## Evidence checked

### Persisted runtime state is still breaching

Runtime metric row for `aks-rp-e2e.task.stale-active-with-gaps`:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1784006383618` (`2026-07-14T05:19:43.618Z`)

Open alert row:

- `metric_alerts.id = 3594`
- `alert_type = consecutive_failures`
- `resolved_at = null`
- `created_at = 1784006427482` (`2026-07-14T05:20:27.482Z`)

Recent snapshots show one new breach after a healthy run:

- `1784006383618 -> 1`
- previous snapshot `1784006078738 -> 0`
- the eight snapshots before that were also `0`

### Live metric source already computes healthy

Fresh recompute from the metric source command path:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.task.stale-active-with-gaps --json
# => {"measuredAt":1784006501687,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

So the source-of-truth metric logic no longer sees a stale active task with verification gaps.

### Current project health agrees there is no stale active task

`bun run health -- --json` now reports:

- `staleActiveTaskIds: []`
- active frontier: `ops/repair-focus-plan-owner-return-lineage-alignment-20260714`
- review frontier: `domain/audit-vm-prerelease-mounted-source-blockers-20260714`
- runnable frontier count: `2`

This means the project still has live movement and visible work, but not the specific stale-active failure shape this alert measures.

### The metric contract still matches the intended signal

The metric source remains:

```ts
!tasks.projectClosed && tasks.activeStale > 0 && openGaps > 0 ? 1 : 0
```

That contract is still appropriate for a P0 stuck-state detector. This triage does **not** justify `calibrate_metric`, `downgrade_priority`, or `document_exception`.

## Why this is waiting_with_evidence

- The persisted metric row and alert are still open.
- The live recompute is already back in range (`0`).
- Current health also reports no stale active tasks.
- This session only has read-only runtime DB access, so there is no safe write path here to resolve `metric_alerts` or rewrite `metrics.current` directly.

## Next validation

Accept the next `metrics-snapshot` / normal alert recovery cycle as the validator.

Expected recovery condition:

- persisted `metrics.current` for `aks-rp-e2e.task.stale-active-with-gaps` moves from `1` to `0`, and
- alert `3594` resolves automatically.

If the next persisted snapshot still reports `1` while the direct source command continues to return `0`, re-triage this as a metric-state-sync defect rather than as a live stale-active task breach.
