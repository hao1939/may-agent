# Metric alert triage — waiting_with_evidence — `aks-rp-e2e.process.unowned-work-count`

- Alert id: `3499`
- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Judged at: `2026-07-13T01:34:50Z`
- Chosen operation: `waiting_with_evidence`

## Judgment

Choose `waiting_with_evidence` because the persisted runtime metric row and open alert still show a breach (`current=1`, `resolved_at=null`), but a fresh owner-side recompute from the metric source command now returns `value=0` with no contributors. There is no live unowned-work item left for app-ops to repair safely in this session, and this triage environment exposes only read-only runtime DB access, so the owner cannot directly resolve `metric_alerts` or rewrite `metrics.current` here.

## Evidence checked

### Persisted runtime state still shows the alert open

Runtime `metrics` row for `aks-rp-e2e.process.unowned-work-count`:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1783906196421`
- `source_command = bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json`

Open alert row:

- `metric_alerts.id = 3499`
- `resolved_at = null`
- `created_at = 1783906211449`

Latest persisted snapshot still shows the stale contributor set from the earlier sample:

- `measured_at = 1783906196421`
- `value = 1`
- `staleActiveTaskIds = ["domain/prepare-rp-operation-status-polling-same-lineage-proof-recipe-20260713"]`
- `staleActiveTaskSessions[0].sessionId = "s_task_domain_prepare-rp-operation-status-polling-same-lineage-proof-recipe-20260713_retry_20260713011607"`
- `staleActiveTaskSessions[0].restartReason = "session-no-activity"`

### Fresh live recompute is already healthy

Fresh recompute from the metric source command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json
```

Observed result:

```json
{"measuredAt":1783906490633,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-13T01:34:50.859Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

So the current live metric source no longer finds:

- stale active task ids,
- stale workflow runs,
- assignment mismatch keys, or
- recovery-unowned spec ids.

### The previously flagged task has already moved forward

Recent runtime sessions and events for the earlier flagged task now show closure activity instead of an unowned gap:

- task-worker session `s_task_domain_prepare-rp-operation-status-polling-same-lineage-proof-recipe-20260713_retry_20260713013312` finished `status=done`, `outcome=done`
- `project.task.completed` was emitted for `domain/prepare-rp-operation-status-polling-same-lineage-proof-recipe-20260713`
- task review session for that task is now running
- the only remaining open pair tied to the old stalled attempt is a `session` pair for `s_task_domain_prepare-rp-operation-status-polling-same-lineage-proof-recipe-20260713_retry_20260713011607`, which no longer contributes to the current metric recompute

## Why this is `waiting_with_evidence`

This alert is no longer a live process-closure defect that app-ops can fix inside this session.

What is true now:

1. The persisted metric row and open alert still reflect the earlier breach.
2. The live metric source command now returns `0` with no contributors.
3. That means there is no current root-cause repair left to apply for this metric.
4. This environment does not provide a safe runtime write path to clear the stale alert row directly.

Because the current live source is already in range, `fix_root_cause` would be misleading for this session, and `resolve_stale` would require a runtime write path that is not available here. The concrete owner action taken is to record durable evidence that the breach has already recovered in the live source of truth and should now be validated by the next normal metrics refresh.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle.

Expected outcomes:

- persisted `metrics.current` for `aks-rp-e2e.process.unowned-work-count` updates from `1` to `0`, and
- alert `3499` resolves automatically.

If the next refresh still persists `1`, re-triage using the fresh contributor sets from `project-metrics.ts` rather than the stale snapshot payload above.
