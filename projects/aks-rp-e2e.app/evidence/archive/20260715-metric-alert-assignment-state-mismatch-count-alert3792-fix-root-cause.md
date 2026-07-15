# Metric alert triage — `aks-rp-e2e.process.assignment-state-mismatch-count` (alert 3792)

- Date: 2026-07-15
- Final operation: `fix_root_cause`
- Metric id: `aks-rp-e2e.process.assignment-state-mismatch-count`
- Alert id: `3792`
- Owner: `app-ops`

## Judgment

The breach was real at judgment time and safe to repair through the supported app control plane.

A fresh live recompute still returned `value = 1` and named exactly one mismatch contributor:

- task id: `ops/repair-compact-loop-azure-cli-command-log-dispatch-hold-20260715`
- attempt id: `a_ops_repair-compact-loop-azure-cli-command-log-dispatch-hold-20260715_20260715080044`
- correlation key: `ops/repair-compact-loop-azure-cli-command-log-dispatch-hold-20260715:a_ops_repair-compact-loop-azure-cli-command-log-dispatch-hold-20260715_20260715080044`

Primary sources showed that this task had already been marked `done` / `resolution = replaced` and archived as a false host-sandbox signal, but its runtime `project.task` pair was still open.

## Evidence checked before repair

### 1) Persisted metric row was still breaching

```sql
SELECT id, current, threshold, target, priority, status, updated_at
FROM metrics
WHERE id = 'aks-rp-e2e.process.assignment-state-mismatch-count';
```

Observed result before repair:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1784103807810`

### 2) Fresh live metric recompute confirmed the breach was current

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.assignment-state-mismatch-count -- --json
```

Observed result before repair:

```json
{"measuredAt":1784103996129,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1,"sampleSize":1,"note":"{\"mismatches\":[{\"correlationKey\":\"ops/repair-compact-loop-azure-cli-command-log-dispatch-hold-20260715:a_ops_repair-compact-loop-azure-cli-command-log-dispatch-hold-20260715_20260715080044\",\"taskId\":\"ops/repair-compact-loop-azure-cli-command-log-dispatch-hold-20260715\",\"attemptId\":\"a_ops_repair-compact-loop-azure-cli-command-log-dispatch-hold-20260715_20260715080044\",\"taskState\":null,\"reason\":\"task-missing\",\"sessionId\":null,\"sessionStatus\":null,\"sessionOutcome\":null,\"sessionStartedAt\":null,\"sessionLastActivityAt\":null,\"sessionEndedAt\":null}]}"}
```

### 3) The exact runtime mismatch was one stale open `project.task` pair

```sql
SELECT id, correlation_key, open_event_id, close_event_id, status, opened_at, closed_at, note
FROM event_pair_runs
WHERE correlation_key = 'ops/repair-compact-loop-azure-cli-command-log-dispatch-hold-20260715:a_ops_repair-compact-loop-azure-cli-command-log-dispatch-hold-20260715_20260715080044';
```

Observed result before repair:

- `id = 427070`
- `open_event_id = 3235367`
- `close_event_id = null`
- `status = open`

### 4) The task was already archived as replaced

Primary-source archive and journal entries showed:

- `.state/tasks/archive/done-leaves-20260715080654155.json` contains task `ops/repair-compact-loop-azure-cli-command-log-dispatch-hold-20260715`
- `.state/journal.jsonl` records:
  - `2026-07-15T08:00:44.191Z` assigned attempt `a_ops_repair-compact-loop-azure-cli-command-log-dispatch-hold-20260715_20260715080044`
  - `2026-07-15T08:04:54.458Z` marked the task done with `resolution = replaced`
  - summary: `Retired as a false host-sandbox signal. The runtime container controller subsequently queried ADO successfully and cleared dispatchHeld; no repository repair is required.`

That proved the metric was flagging stale runtime bookkeeping, not live work.

## Concrete repair applied

I used the supported runtime ingress `POST http://127.0.0.1:8080/api/events` and emitted one bounded synthetic `project.task.completed` repair event for that archived task/attempt pair.

Request body:

```json
{
  "type": "project.task.completed",
  "source": "metric-alert-triage-assignment-state-mismatch-count-3792",
  "owner": "project:aks-rp-e2e",
  "target": {
    "project": "aks-rp-e2e",
    "taskId": "ops/repair-compact-loop-azure-cli-command-log-dispatch-hold-20260715"
  },
  "data": {
    "project": "aks-rp-e2e",
    "projectId": "aks-rp-e2e",
    "taskId": "ops/repair-compact-loop-azure-cli-command-log-dispatch-hold-20260715",
    "task_id": "ops/repair-compact-loop-azure-cli-command-log-dispatch-hold-20260715",
    "attemptId": "a_ops_repair-compact-loop-azure-cli-command-log-dispatch-hold-20260715_20260715080044",
    "attempt_id": "a_ops_repair-compact-loop-azure-cli-command-log-dispatch-hold-20260715_20260715080044",
    "sessionId": "s_task_ops_repair-compact-loop-azure-cli-command-log-dispatch-hold-20260715_loop-azure-cli-command-log-dispatch-hold-20260715_20260715080044",
    "session_id": "s_task_ops_repair-compact-loop-azure-cli-command-log-dispatch-hold-20260715_loop-azure-cli-command-log-dispatch-hold-20260715_20260715080044",
    "status": "done",
    "result": "done",
    "claim": "done",
    "summary": "Synthetic runtime repair completion emitted to close the stale open project.task pair after the compact-loop Azure CLI dispatch-hold task was replaced and archived as a false host-sandbox signal.",
    "reason": "runtime-pair-repair",
    "repair": true
  }
}
```

Observed HTTP response:

```json
{"ok":true,"triggered":true,"eventType":"project.task.completed","reason":"runtime-pair-repair","workflowStarted":false,"workflowRunId":null,"workflowStatus":null,"featureTestRequest":null,"featureTestFeedback":null}
```

## Validation after repair

### 1) The pair is now closed and the live metric recovered

```sql
SELECT id, correlation_key, open_event_id, close_event_id, status, opened_at, closed_at, note
FROM event_pair_runs
WHERE correlation_key = 'ops/repair-compact-loop-azure-cli-command-log-dispatch-hold-20260715:a_ops_repair-compact-loop-azure-cli-command-log-dispatch-hold-20260715_20260715080044';
```

Observed result after repair window:

- `status = closed`
- `close_event_id = 3237086`
- `closed_at = 1784104058380`

Fresh live metric recompute after the repair window:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.assignment-state-mismatch-count -- --json
```

Observed result:

```json
{"measuredAt":1784104068816,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"mismatches\":[]}"}
```

### 2) Race note: a sibling alert emitted the first matching close event seconds earlier

During the same repair window, sibling alert `3791` (`task-tree-problem-count`) emitted accepted close event `3237086` for the same archived task/attempt pair first.

Current runtime `events` for this exact task/attempt now show two accepted synthetic close events:

1. `3237086` from source `metric-alert-triage-task-tree-problem-count-3791`
2. `3237093` from source `metric-alert-triage-assignment-state-mismatch-count-3792`

The first event is the one recorded as `event_pair_runs.close_event_id`, but the second event is also accepted and confirms this alert followed the same supported repair path rather than attempting any direct DB mutation.

### 3) Persisted metric row is still awaiting the next snapshot refresh

At the end of this session, runtime `metrics.current` for `aks-rp-e2e.process.assignment-state-mismatch-count` still read `1` at `updated_at = 1784103807810`, and alert `3792` remained unresolved in `metric_alerts`.

That remaining gap is snapshot lifecycle only. The live source of truth is already clear (`value = 0`, `mismatches = []`).

## Why this is `fix_root_cause`

The alert was real when judged, and app-ops could safely correct the stale runtime pair through the supported `/api/events` control plane. The live metric source recovered to zero immediately after the repair window, proving the underlying mismatch contributor is gone.

## Next validation

Use the next `metrics-snapshot` / alert reconciliation cycle for `aks-rp-e2e.process.assignment-state-mismatch-count` to confirm persisted `metrics.current` updates from `1` to `0` and alert `3792` auto-recovers.
