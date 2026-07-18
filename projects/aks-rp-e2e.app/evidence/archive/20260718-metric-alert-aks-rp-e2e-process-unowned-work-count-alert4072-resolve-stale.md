# Metric alert triage — `aks-rp-e2e.process.unowned-work-count` (alert 4072)

- Date: 2026-07-18
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Alert id: `4072`
- Owner: `app-ops`

## Judgment

Alert `4072` was real at sample time, but it is stale at triage completion.

The stored breach came from one stale `project.task` pair for the blocked
managementplane-addon wait-holder:

- task: `ops-apply-queue-managementplane-addon-vm-prerelease-addonv2-create-scale-upgrade-live-ado-20260718-state-repair`
- attempt: `a_ops-apply-queue-managementplane-addon-vm-prerelease-addonv2-create-scale-upgrade-live-ado-20260718-state-repair_20260718004910`
- pair row: `event_pair_runs.id = 546394`

By triage time, the canonical runtime repair had already landed:

- `event_pair_runs.id = 546394` is now `status = closed`
- the closing event is `events.id = 3436404`
- that event is a `project.task.completed` repair with `reason = runtime-pair-repair`
- the latest persisted metric row is already back to `current = 0`
- alert `4072` itself is already resolved (`resolved_at = 1784336979091`)
- a fresh direct recompute returns `value = 0`, `sampleSize = 0`, and no assignment mismatches

So no new process repair, calibration, or escalation is justified. The concrete
owner action here is to record the stale-state judgment with the exact recovery
evidence.

## Evidence checked

### 1) Latest stored metric row is already recovered

```sql
SELECT id, current, threshold, target, priority, status, updated_at, project, owner
FROM metrics
WHERE id = 'aks-rp-e2e.process.unowned-work-count';
```

Observed result excerpt:

- `current = 0`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `owner = app-ops`
- `updated_at = 1784336940287`

### 2) Alert 4072 is already resolved in persisted alert state

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE id = 4072;
```

Observed result excerpt:

- `message = "AKS RP E2E unfinished work without active owner is above threshold: current=1, threshold=0, target=0"`
- `resolved_at = 1784336979091`
- `created_at = 1784336029647`

### 3) Stored snapshots show the stale contributor and then recovery

Recent persisted snapshots:

- `1784336630325 -> value = 1` with `assignmentMismatchKeys = ["ops-apply-queue-managementplane-addon-vm-prerelease-addonv2-create-scale-upgrade-live-ado-20260718-state-repair:a_ops-apply-queue-managementplane-addon-vm-prerelease-addonv2-create-scale-upgrade-live-ado-20260718-state-repair_20260718004910"]`
- `1784336287798 -> value = 1` with the same contributor
- `1784335995081 -> value = 1` with the same contributor
- `1784336940287 -> value = 0` with empty `assignmentMismatchKeys`

That shows the alert row lagged one concrete repaired contributor rather than a
new unknown breach.

### 4) The exact `project.task` pair is closed now

```sql
SELECT id, pair_name, correlation_key, open_event_id, close_event_id, owner, status,
       opened_at, expected_close_at, closed_at, note
FROM event_pair_runs
WHERE pair_name = 'project.task'
  AND correlation_key = 'ops-apply-queue-managementplane-addon-vm-prerelease-addonv2-create-scale-upgrade-live-ado-20260718-state-repair:a_ops-apply-queue-managementplane-addon-vm-prerelease-addonv2-create-scale-upgrade-live-ado-20260718-state-repair_20260718004910';
```

Observed result excerpt:

- `id = 546394`
- `status = closed`
- `close_event_id = 3436404`
- `closed_at = 1784336738939`

### 5) The closing repair event exists and matches the stale pair

```sql
SELECT id, event_type, source, owner, timestamp,
       json_extract(data, '$.taskId') AS taskId,
       json_extract(data, '$.attemptId') AS attemptId,
       json_extract(data, '$.reason') AS reason,
       json_extract(data, '$.repair') AS repair,
       json_extract(data, '$.summary') AS summary
FROM events
WHERE id = 3436404;
```

Observed result excerpt:

- `event_type = project.task.completed`
- `taskId = ops-apply-queue-managementplane-addon-vm-prerelease-addonv2-create-scale-upgrade-live-ado-20260718-state-repair`
- `attemptId = a_ops-apply-queue-managementplane-addon-vm-prerelease-addonv2-create-scale-upgrade-live-ado-20260718-state-repair_20260718004910`
- `reason = runtime-pair-repair`
- `repair = 1`

### 6) Fresh direct recompute is clean now

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.unowned-work-count -- --json
```

Observed result:

```json
{"measuredAt":1784337012869,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-18T01:10:12.922Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

### 7) The wait-holder itself remains a truthful exact blocked wait

`bun run task-tree show ops-apply-queue-managementplane-addon-vm-prerelease-addonv2-create-scale-upgrade-live-ado-20260718-state-repair`
shows:

- `state = blocked`
- owner `app-ops`
- blocker owner `ado`
- exact wait on run `172769455`
- next check `2026-07-18T01:22:51.772Z`
- fallback `2026-07-18T02:52:51.772Z`

That means the project still has an owner-visible blocked wait, not unowned work.

## Why this is `resolve_stale`

The breach was caused by a stale open pair that has already been closed through
the supported runtime repair path. Both the latest persisted metric row and a
fresh source-command recompute now report `0`, and the alert row itself is
resolved. The remaining action is documentation of the stale-state judgment, not
another mutation.

## Next validation

Treat the latest persisted `0` snapshot at `2026-07-18T01:09:00.287Z` as the
closure signal. If a future `metrics-snapshot` reopens the metric above `0`,
reinvestigate only with the then-current `assignmentMismatchKeys` contributor
set.
