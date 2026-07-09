# Metric alert triage — `resolve_stale` — `aks-rp-e2e.process.unowned-work-count`

- Alert id: `3228`
- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Triage time: `2026-07-09T05:13:34Z`
- Chosen operation: `resolve_stale`

## Judgment

This alert row is stale relative to current project state.

The latest open-alert snapshot at `2026-07-09T05:09:45Z` counted exactly one contributor:

- `staleActiveTaskIds = ["ops-own-current-unpublished-fleet-slice-20260709"]`
- `restartReason = "session-not-running"`

That contributor is no longer active unowned work:

1. `bun run task-tree show ops-own-current-unpublished-fleet-slice-20260709` now shows the task in `state: "review"`, with `last_worker_result: "done"` and `last_worker_completed_at: "2026-07-09T05:09:45.924Z"`.
2. Runtime `sessions` shows `sessionId = s_task_ops-own-current-unpublished-fleet-slice-20260709` ended with `status = "done"` and `outcome = "done"`.
3. `bun run task-tree frontier` no longer lists that task under `active`; it appears under `review`.
4. Fresh live resample of the metric now returns:

```json
{"measuredAt":1783574014614,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-09T05:13:34.665Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

## Conclusion

The metric source has already recovered to in-range (`value = 0`). The still-open alert row is therefore stale/transient and should be cleared by the next safe runtime alert-evaluation / recovery cycle rather than treated as live ownerless work.

## Next validation

- Next `metrics-snapshot` / alert evaluation should refresh `metrics.current` for `aks-rp-e2e.process.unowned-work-count` to `0` and emit normal recovery handling for alert `3228`.
