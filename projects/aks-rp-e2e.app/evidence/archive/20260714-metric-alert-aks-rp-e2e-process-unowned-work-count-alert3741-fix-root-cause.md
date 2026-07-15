# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.unowned-work-count`

- Alert id: `3741`
- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Owner: `app-ops`
- Priority: `P0`
- Judged at: `2026-07-15T00:07:19Z`
- Chosen operation: `fix_root_cause`

## Why the breach was real

The latest persisted snapshots all showed `value = 1` with one exact contributor, and a fresh recompute before repair still returned the same live breach:

```json
{"measuredAt":1784073989487,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1,"sampleSize":1,"note":"{\"sampledAt\":\"2026-07-15T00:06:29.529Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[\"ops-apply-apply-runtime-blank-resume-escalation-repair-20260714-state-re:a_ops-apply-apply-runtime-blank-resume-escalation-repair-20260714-state-re_20260714235059\"],\"assignmentMismatchTasks\":[{\"correlationKey\":\"ops-apply-apply-runtime-blank-resume-escalation-repair-20260714-state-re:a_ops-apply-apply-runtime-blank-resume-escalation-repair-20260714-state-re_20260714235059\",\"taskId\":\"ops-apply-apply-runtime-blank-resume-escalation-repair-20260714-state-re\",\"attemptId\":\"a_ops-apply-apply-runtime-blank-resume-escalation-repair-20260714-state-re_20260714235059\",\"taskState\":\"blocked\",\"reason\":\"task-not-active\",\"sessionId\":\"s_task_ops-apply-apply-runtime-blank-resume-escalation-repair-20260714-state-re_-blank-resume-escalation-repair-20260714-state-re_20260714235059\",\"sessionStatus\":\"done\",\"sessionOutcome\":\"done\",\"sessionStartedAt\":1784073063557,\"sessionLastActivityAt\":1784073277775,\"sessionEndedAt\":1784073277775}],\"recoveryUnownedSpecIds\":[]}"}
```

Primary-source runtime inspection showed the exact stale open pair:

- `event_pair_runs.id = 411089`
- `pair_name = project.task`
- `correlation_key = ops-apply-apply-runtime-blank-resume-escalation-repair-20260714-state-re:a_ops-apply-apply-runtime-blank-resume-escalation-repair-20260714-state-re_20260714235059`
- `status = open`
- `open_event_id = 3209052`

At the same time, the live task tree already showed that task as an exact blocked wait carrier rather than active work:

- `task-tree show ops-apply-apply-runtime-blank-resume-escalation-repair-20260714-state-re`
- `state = blocked`
- `status = blocked`
- `trace.blocked_wait_refreshed_at = 2026-07-14T23:53:29.307Z`
- blocker metadata names `waiting_for.metricId = aks-rp-e2e.spec.blocked-count`

So this alert was a real process gap, but the gap was stale runtime pair bookkeeping rather than truly ownerless unfinished work.

## Concrete repair applied

I used the supported runtime ingress `POST http://127.0.0.1:8080/api/events` and emitted one exact synthetic `project.task.completed` repair event with source `metric-alert-triage-unowned-work-count-3741`:

```json
{
  "type": "project.task.completed",
  "source": "metric-alert-triage-unowned-work-count-3741",
  "owner": "project:aks-rp-e2e",
  "target": {
    "project": "aks-rp-e2e",
    "taskId": "ops-apply-apply-runtime-blank-resume-escalation-repair-20260714-state-re"
  },
  "data": {
    "project": "aks-rp-e2e",
    "projectId": "aks-rp-e2e",
    "taskId": "ops-apply-apply-runtime-blank-resume-escalation-repair-20260714-state-re",
    "task_id": "ops-apply-apply-runtime-blank-resume-escalation-repair-20260714-state-re",
    "attemptId": "a_ops-apply-apply-runtime-blank-resume-escalation-repair-20260714-state-re_20260714235059",
    "attempt_id": "a_ops-apply-apply-runtime-blank-resume-escalation-repair-20260714-state-re_20260714235059",
    "sessionId": "s_task_ops-apply-apply-runtime-blank-resume-escalation-repair-20260714-state-re_-blank-resume-escalation-repair-20260714-state-re_20260714235059",
    "status": "blocked",
    "result": "blocked",
    "claim": "blocked",
    "summary": "Synthetic runtime repair completion emitted to close the stale open project.task pair after the worker converted this task into the exact blocked owner-decision wait carrier for esc_1784054467358_jnkbho.",
    "reason": "runtime-pair-repair",
    "repair": true
  }
}
```

The HTTP ingress response was accepted immediately:

```json
{"ok":true,"triggered":true,"eventType":"project.task.completed","reason":"runtime-pair-repair","workflowStarted":false,"workflowRunId":null,"workflowStatus":null,"featureTestRequest":null,"featureTestFeedback":null}
```

## Validation after repair

### 1) The repair completion event was accepted

Runtime `events` now shows:

- `id = 3209671`
- `event_type = project.task.completed`
- `source = metric-alert-triage-unowned-work-count-3741`
- `delivery_status = accepted`
- `taskId = ops-apply-apply-runtime-blank-resume-escalation-repair-20260714-state-re`
- `attemptId = a_ops-apply-apply-runtime-blank-resume-escalation-repair-20260714-state-re_20260714235059`
- `reason = runtime-pair-repair`
- `repair = 1`
- `data.status = blocked`
- `data.claim = blocked`

### 2) The stale pair is now closed

`event_pair_runs` for the same correlation key now shows:

- `id = 411089`
- `status = closed`
- `close_event_id = 3209671`
- `closed_at = 1784074032194`

### 3) Fresh live recomputes recovered to zero

Unowned-work recompute after repair:

```json
{"measuredAt":1784074039014,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-15T00:07:19.069Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

Companion mismatch recompute after repair:

```json
{"measuredAt":1784074038863,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"mismatches\":[]}"}
```

## Why this is `fix_root_cause`

The alert was still correctly signaling a live process integrity gap when judged. App-ops could safely correct the exact stale `project.task` pair through the supported runtime event ingress without changing metric policy, and the live metric source immediately recovered to `0`.

## Next validation

Wait for the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.unowned-work-count`. Recovery is confirmed when the persisted `metrics.current` row updates from `1` to `0` and alert `3741` auto-recovers.
