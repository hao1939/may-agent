# Metric alert triage — aks-rp-e2e.process.integrity.task-tree-problem-count (alert 2989)

- Alert id: `2989`
- Metric id: `aks-rp-e2e.process.integrity.task-tree-problem-count`
- Judged at: `2026-07-07T12:33Z`
- Chosen operation: `fix_root_cause`

## Current breach at triage

A fresh direct recompute showed the alert was still real at triage time, not a stale row:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.integrity.task-tree-problem-count --json
```

Observed before repair:

```json
{ "measuredAt": 1783427592696, "value": 2 }
```

The metric implementation counts:

- `1` when task-tree root count is not exactly one, plus
- `assignmentStateMismatch` for open/orphan `project.task` pair rows whose task is missing or no longer `active`.

`task-tree summary` still showed exactly one root (`project`), so the breach came from runtime assignment-state mismatches rather than root structure.

## Exact root cause

The live runtime tree in `.state/tasks/tree.json` had two tasks already closed in the task tree, but their corresponding `event_pair_runs` rows were still open:

1. `verify-dev-infra-core-single-spec-live-passes-20260707:a_verify-dev-infra-core-single-spec-live-passes-20260707_20260707122411`
   - task state in `.state/tasks/tree.json`: `done`
2. `run-dev-infra-core-planned-ado-pass-20260707:a_run-dev-infra-core-planned-ado-pass-20260707_20260707122732`
   - task state in `.state/tasks/tree.json`: `done`
   - task was already replaced by exact blocked wait `wait-dev-infra-core-ado-run-171186535-result-20260707`

Open pair rows observed before repair:

```text
verify-dev-infra-core-single-spec-live-passes-20260707:a_verify-dev-infra-core-single-spec-live-passes-20260707_20260707122411
run-dev-infra-core-planned-ado-pass-20260707:a_run-dev-infra-core-planned-ado-pass-20260707_20260707122732
reconcile-compact-loop-live-workflow-202607071227:a_reconcile-compact-loop-live-workflow-202607071227_20260707122707
link-compact-package-partial-writeback-slice-20260707:a_link-compact-package-partial-writeback-slice-20260707_20260707123241
```

Only the first two were mismatches because their task states were no longer `active`; the latter two were still live active tasks.

## Concrete repair applied

I used the supported runtime ingress `POST /api/events` to emit exact matching `project.task.completed` close events for the two stale correlation keys, instead of editing the database directly.

### Repair 1: close stale verify pair

```json
{
  "type": "project.task.completed",
  "source": "metric-alert-triage-task-tree-problem-count-2989",
  "owner": "project:aks-rp-e2e",
  "target": {
    "project": "aks-rp-e2e",
    "taskId": "verify-dev-infra-core-single-spec-live-passes-20260707"
  },
  "data": {
    "project": "aks-rp-e2e",
    "projectId": "aks-rp-e2e",
    "taskId": "verify-dev-infra-core-single-spec-live-passes-20260707",
    "task_id": "verify-dev-infra-core-single-spec-live-passes-20260707",
    "attemptId": "a_verify-dev-infra-core-single-spec-live-passes-20260707_20260707122411",
    "attempt_id": "a_verify-dev-infra-core-single-spec-live-passes-20260707_20260707122411",
    "status": "done",
    "result": "done",
    "claim": "done",
    "summary": "Synthetic runtime repair completion emitted to close stale open project.task pair after task was already marked done.",
    "reason": "runtime-pair-repair",
    "repair": true
  }
}
```

Runtime response:

```json
{
  "ok": true,
  "triggered": true,
  "eventType": "project.task.completed",
  "reason": "runtime-pair-repair",
  "workflowStarted": false,
  "workflowRunId": null,
  "workflowStatus": null,
  "featureTestRequest": null,
  "featureTestFeedback": null
}
```

### Repair 2: close stale planned-run pair

```json
{
  "type": "project.task.completed",
  "source": "metric-alert-triage-task-tree-problem-count-2989",
  "owner": "project:aks-rp-e2e",
  "target": {
    "project": "aks-rp-e2e",
    "taskId": "run-dev-infra-core-planned-ado-pass-20260707"
  },
  "data": {
    "project": "aks-rp-e2e",
    "projectId": "aks-rp-e2e",
    "taskId": "run-dev-infra-core-planned-ado-pass-20260707",
    "task_id": "run-dev-infra-core-planned-ado-pass-20260707",
    "attemptId": "a_run-dev-infra-core-planned-ado-pass-20260707_20260707122732",
    "attempt_id": "a_run-dev-infra-core-planned-ado-pass-20260707_20260707122732",
    "status": "done",
    "result": "done",
    "claim": "done",
    "summary": "Synthetic runtime repair completion emitted to close stale open project.task pair after task was already replaced by exact blocked wait wait-dev-infra-core-ado-run-171186535-result-20260707.",
    "reason": "runtime-pair-repair",
    "repair": true
  }
}
```

Runtime response:

```json
{
  "ok": true,
  "triggered": true,
  "eventType": "project.task.completed",
  "reason": "runtime-pair-repair",
  "workflowStarted": false,
  "workflowRunId": null,
  "workflowStatus": null,
  "featureTestRequest": null,
  "featureTestFeedback": null
}
```

## Validation after repair

Fresh recompute after repair:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.integrity.task-tree-problem-count --json
```

Observed after repair:

```json
{ "measuredAt": 1783427624884, "value": 0 }
```

Runtime pair rows after repair:

- `verify-dev-infra-core-single-spec-live-passes-20260707:...` → `status=closed`, `close_event_id=2788399`
- `run-dev-infra-core-planned-ado-pass-20260707:...` → `status=closed`, `close_event_id=2788396`

## Why this is `fix_root_cause`

The alert was real and locally fixable. The root cause was stale runtime `project.task` pair rows left open after the task tree had already moved those leaves to `done`/replaced state. Emitting the exact missing completion events through supported runtime ingress repaired the source of the metric without changing thresholds or priorities.

## Next validation

Wait for the next `metrics-snapshot` to refresh the persisted metric row and recover alert `2989` from the current live value `0`.
