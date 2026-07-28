# Metric alert triage — resolve_stale — `aks-rp-e2e.process.unowned-work-count`

- Alert id: `4251`
- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Owner: `app-ops`
- Priority: `P0`
- Judged at: `2026-07-28T23:31:13Z`
- Chosen operation: `resolve_stale`

## Judgment

Alert `4251` was real at sampling time but is stale by triage time.

The persisted metric row and open alert still show the breaching snapshot from `2026-07-28T23:28:42Z` (`current=1`), but a fresh owner-side recompute now returns `0` with no contributors. The exact contributor named in the stored snapshot was `scenario-normalization`; that task has since been restarted into a fresh running attempt at `2026-07-28T23:30:15Z`, so the current live state no longer represents unfinished work without an active owner.

## Evidence checked

### 1. Persisted metric state is still breaching

Runtime DB still shows:

- `metrics.current = 1`
- `metrics.threshold = 0`
- `metrics.target = 0`
- `metrics.priority = P0`
- `metrics.updated_at = 1785281320206` (`2026-07-28T23:28:40.206Z`)
- open alert `metric_alerts.id = 4251` with `resolved_at = null`

The latest stored breaching snapshot cites one contributor:

- `staleActiveTaskIds = ["scenario-normalization"]`
- `staleActiveTaskSessions = [{"taskId":"scenario-normalization","sessionId":null,"restartReason":"missing-session"}]`

### 2. Fresh live recompute is healthy now

A fresh owner-side metric sample now returns zero contributors:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json
```

Result:

```json
{"measuredAt":1785281472530,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-28T23:31:13.929Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

### 3. The cited task has already been restarted into a fresh active attempt

Current live task state for `scenario-normalization` now shows:

- `phase = "running"`
- `status.updatedAt = "2026-07-28T23:30:15.496Z"`
- `status.currentAttemptId = "r_20_c25beb80-a704-4ee8-af2a-913158dae44e"`
- tree `active_attempt.started_at = "2026-07-28T23:30:15.496Z"`
- tree `active_attempt.state = "running"`

So the exact stale-active condition from the alert snapshot is no longer present. The task is back in a fresh controller-owned workflow attempt rather than sitting as an old active task with no owner session.

## Why `resolve_stale`

There is no current unowned-work contributor left for app-ops to repair safely in this session. The breach came from a transient stale-active state that had already recovered by the time of triage. The current authoritative metric source is already back in range (`0`), so the still-open alert row is lagging current reality.

This workflow does not provide a safe runtime write path to resolve `metric_alerts` directly, so the concrete action here is to record the stale-state judgment durably and let the next metrics snapshot / alert lifecycle close the row normally.

## Next validation

Validate on the next `metrics-snapshot` / alert recovery cycle for `aks-rp-e2e.process.unowned-work-count`.

Expected result:

- persisted `metrics.current` updates from `1` to `0`, and
- alert `4251` resolves automatically.
