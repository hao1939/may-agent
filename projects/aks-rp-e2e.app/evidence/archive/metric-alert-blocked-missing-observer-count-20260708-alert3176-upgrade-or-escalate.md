# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` — alert `3176`

- Operation: `upgrade_or_escalate`
- Judged by: `app-ops`
- Judged at: `2026-07-08T02:41Z`

## Decision

Choose `upgrade_or_escalate` because the owner safely repaired the live blocked task named by the metric, but a fresh metric sample still reports the same task as missing observer metadata even though the runtime task tree now shows the required observer contract fields.

This is no longer a plain blocked-contract omission that app-ops can safely fix with the supported owner repair path alone. It is now a contradiction between:

1. the supported repair tool,
2. the runtime task-tree read path, and
3. the metric sampler output.

## Evidence checked

### 1) Persisted metric row is still breaching

Runtime metric facts at triage time:

- metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1783531581516`

### 2) Fresh metric sample identifies one current offender

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result before repair and again after repair:

```json
{"measuredAt":1783531693997,"value":1,"sampleSize":1,"note":"{\"offenderTaskIds\":[\"hold-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260708\"]}"}
```

and later:

```json
{"measuredAt":1783531715759,"value":1,"sampleSize":1,"note":"{\"offenderTaskIds\":[\"hold-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260708\"]}"}
```

### 3) Supported dry-run repair agrees the task is considered repairable

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts --dry-run
```

Observed result excerpt:

```json
{
  "dryRun": true,
  "repairedCount": 1,
  "repaired": [
    "hold-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260708"
  ]
}
```

### 4) The supported owner repair path was actually applied

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts
```

Observed result excerpt:

```json
{
  "dryRun": false,
  "repairedCount": 1,
  "repaired": [
    "hold-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260708"
  ]
}
```

### 5) Runtime task inspection now shows the observer contract fields present

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree show hold-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260708
```

Observed blocker fields after repair:

```json
{
  "waiting_for": {
    "type": "environment.available",
    "taskId": "hold-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260708",
    "sourceRunId": "28656258055"
  },
  "observed_by": {
    "workflow": "project-planner",
    "schedule": "blocked-frontier-app-ops-review",
    "trigger": "project.planning.requested"
  },
  "observation_method": "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
  "next_check_at": "2026-07-09T17:30:00Z"
}
```

Its trace also now includes:

```json
{
  "blocked_contract_repaired_at": "2026-07-08T17:28:34.856Z"
}
```

### 6) A direct owner-side read using the same `readTaskTree(taskTreeConfig(...))` path says the task is no longer missing observer metadata

Observed result:

```json
{
  "tree_updated_at": "2026-07-08T17:30:07.881Z",
  "missing": false
}
```

### 7) Contradiction remains after repair

Even after the safe repair and direct task-tree verification, the metric sampler still returns `value = 1` and still names the same repaired task id as the offender.

That means app-ops has exhausted the safe blocked-contract repair path available in this triage surface, and what remains is a tooling/runtime contradiction rather than a simple missing observer field.

## Escalation needed

Project-maintainer / human judgment is needed to decide which implementation is authoritative and what to repair next:

1. fix the metric sampling path so it stops flagging already-repaired blocked tasks, or
2. identify a hidden/stale task-tree read path that the metric sampler still uses, or
3. correct the blocked-contract repair logic if it is writing fields that the sampler intentionally ignores.

Do not clear this by ad hoc DB edits. The safe owner repair path for the runtime task tree has already been used.

## Next validation

Validate on the next `metrics-snapshot` or after a maintainer fix to the blocked-contract/metric parity path. Recovery is confirmed only when a fresh sample for `aks-rp-e2e.process.blocked.missing-observer-count` returns `value = 0` and alert `3176` resolves.
