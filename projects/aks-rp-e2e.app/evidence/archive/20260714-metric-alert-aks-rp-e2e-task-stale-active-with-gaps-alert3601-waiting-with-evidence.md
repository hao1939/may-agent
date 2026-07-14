# Metric alert triage — waiting_with_evidence — `aks-rp-e2e.task.stale-active-with-gaps`

Date: 2026-07-14T05:43Z  
Alert id: `3601`  
Metric id: `aks-rp-e2e.task.stale-active-with-gaps`

## Judgment

Choose `waiting_with_evidence` because the persisted runtime metric row and open alert still show a breach (`current=1` at `2026-07-14T05:40:17.219Z`), but a fresh owner-side recompute now returns `0`, the unowned-work source reports `staleActiveTaskIds: []`, and the current task frontier has no active leaves. There is no current stale active task for app-ops to repair safely in this session, so the truthful action is to document the now-healthy live source state and wait for the next normal metrics snapshot / alert recovery cycle to catch up.

## Evidence checked

### Persisted runtime state is still breaching

Runtime metric row for `aks-rp-e2e.task.stale-active-with-gaps`:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`
- `updated_at = 1784007617219` (`2026-07-14T05:40:17.219Z`)
- `source_command = bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.task.stale-active-with-gaps`

Open alert row:

- `metric_alerts.id = 3601`
- `alert_type = consecutive_failures`
- `resolved_at = null`
- `created_at = 1784007666306` (`2026-07-14T05:41:06.306Z`)

Recent snapshots show the persisted metric still lagging behind current task-tree state:

- `1784007617219 -> 1`
- `1784007306988 -> 0`
- `1784006995620 -> 1`
- `1784006685904 -> 1`
- `1784006383618 -> 1`

### Live metric source already computes healthy

Fresh recompute from the metric source command path:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.task.stale-active-with-gaps --json
# => {"measuredAt":1784007754262,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

So the source-of-truth metric logic no longer sees a stale active task with verification gaps.

### Related process signals agree there is no current stale active task

Fresh unowned-work sample:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json
# => {"measuredAt":1784007754080,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-14T05:42:34.118Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

Current frontier sample:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts frontier
# => active: []
```

Current health snapshot also reports:

- `staleActiveTaskIds: []`
- frontier counts `active = 0`, `review = 0`, `runnable = 0`, `blocked = 129`

This means the project still needs app-ops attention, but not for the specific stale-active failure shape this alert measures.

### The metric contract still matches the intended signal

The metric source remains:

```ts
!tasks.projectClosed && tasks.activeStale > 0 && openGaps > 0 ? 1 : 0
```

That contract is still appropriate for a P0 stuck-state detector. This triage does **not** justify `calibrate_metric`, `downgrade_priority`, or `document_exception`.

## Why this is waiting_with_evidence

- The persisted metric row and alert are still open.
- The live recompute is already back in range (`0`).
- Related live health signals also report no stale active tasks.
- This session has no safe runtime write path to resolve `metric_alerts` or rewrite `metrics.current` directly.

## Next validation

Accept the next `metrics-snapshot` / normal alert recovery cycle as the validator.

Expected recovery condition:

- persisted `metrics.current` for `aks-rp-e2e.task.stale-active-with-gaps` moves from `1` to `0`, and
- alert `3601` resolves automatically.

If the next persisted snapshot still reports `1` while the direct source command continues to return `0`, re-triage this as a metric-state-sync defect rather than as a live stale-active task breach.
