# Metric alert triage — waiting_with_evidence — `aks-rp-e2e.task.stale-active-with-gaps`

Date: 2026-07-15T17:54Z
Alert id: `3852`
Metric id: `aks-rp-e2e.task.stale-active-with-gaps`

## Judgment

Choose `waiting_with_evidence` because the persisted runtime metric row and open alert still show a breach (`current=1`), but a fresh owner-side recompute now returns `0`, the related unowned-work source reports `staleActiveTaskIds: []`, and the current frontier still has active/review work rather than an idle stale-active hole. There is no live stale active task left for app-ops to repair safely in this session, so the truthful action is to document the healthy live source state and wait for the next normal metrics snapshot / alert recovery cycle to catch up.

## Evidence checked

### Persisted runtime state is still breaching

Runtime metric row for `aks-rp-e2e.task.stale-active-with-gaps`:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`
- `updated_at = 1784137385865`
- `source_command = bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.task.stale-active-with-gaps`

Open alert row:

- `metric_alerts.id = 3852`
- `alert_type = consecutive_failures`
- `resolved_at = null`
- `created_at = 1784136652549`

Recent persisted snapshots still show the old breach shape:

- `1784137385865 -> 1`
- `1784136978608 -> 1`
- `1784136340113 -> 1`
- `1784136013774 -> 0`
- `1784135385744 -> 0`

### Live metric source already computes healthy

Fresh recompute from the metric source command path:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.task.stale-active-with-gaps --json
# => {"measuredAt":1784137963624,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

So the source-of-truth metric logic no longer sees a stale active task with verification gaps.

### Related process signals agree there is no current stale active task

Fresh unowned-work sample:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json
# => {"measuredAt":1784138030015,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-15T17:53:50.693Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

Current frontier sample:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts frontier
```

Result excerpt:

- `active` contains 7 live frontier leaves
- `review` contains 20 frontier leaves
- `runnable` is empty
- no stale-active contributor ids are reported by the related unowned-work source

This means verification gaps and active work still exist, but not the specific stale-active failure shape this alert measures.

### Event stream has breach but no post-breach recovery yet

Recent metric lifecycle events for this metric currently show:

- `metric.breach` for alert `3852` at `1784136652856`
- no later `metric.recovered` yet for alert `3852`

That matches a lifecycle-lag explanation: the live source has recovered, but the persisted metric row and alert have not yet been rewritten by the next normal snapshot/evaluation cycle.

### The metric contract still matches the intended signal

The registration still defines this as a P0 stuck-state detector for cases where the task tree says work is active while a leaf has no healthy worker session and verification gaps remain. This triage does **not** justify `calibrate_metric`, `downgrade_priority`, or `document_exception`.

## Why this is waiting_with_evidence

- The persisted metric row and alert are still open.
- The live recompute is already back in range (`0`).
- Related live health signals also report no stale active tasks.
- This session has no safe runtime write path to resolve `metric_alerts` or rewrite `metrics.current` directly.
- The alert is not yet a `resolve_stale` case because runtime has not emitted a matching recovery event or closed the alert row yet.

## Next validation

Accept the next `metrics-snapshot` / normal alert recovery cycle as the validator.

Expected recovery condition:

- persisted `metrics.current` for `aks-rp-e2e.task.stale-active-with-gaps` moves from `1` to `0`, and
- alert `3852` resolves automatically.

If the next persisted snapshot still reports `1` while the direct source command continues to return `0`, re-triage this as a metric-state-sync defect rather than as a live stale-active task breach.
