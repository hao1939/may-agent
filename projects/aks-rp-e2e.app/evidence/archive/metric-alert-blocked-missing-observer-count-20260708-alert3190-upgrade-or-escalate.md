# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` (alert 3190)

- Alert id: `3190`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Triaged at: `2026-07-08T19:20Z`
- Chosen operation: `upgrade_or_escalate`
- Related blocked task: `ops-escalate-blocked-missing-waiting-parity-20260708-alert3189`

## Judgment

This alert is currently driven by a single blocked ops escalation task that the supported repair path has already normalized, but the metric sampler still counts as missing observer metadata. A fresh recompute returned `value=1` and named exactly one offender:

- `ops-escalate-blocked-missing-waiting-parity-20260708-alert3189`

That task exists because the sibling `missing-waiting-for` alert already produced a real parity contradiction between the task-tree repair path and metric sampling. For this observer alert, the same task initially lacked `observed_by`/`observation_method`/`next_check_at`, so it was a valid offender at first. But after running the supported `repair-blocked-contracts` path, the live task readback now shows all required observer fields present while the metric recompute still reports the same task id as missing observer metadata.

Because the safe owner repair path is exhausted and the metric sampler still contradicts the repaired blocked task, the correct final operation is `upgrade_or_escalate` rather than another blind task-tree mutation.

## Evidence checked

### 1) Fresh recompute named the exact offender

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result before repair:

```json
{"measuredAt":1783538310251,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1,"sampleSize":1,"note":"{\"offenderTaskIds\":[\"ops-escalate-blocked-missing-waiting-parity-20260708-alert3189\"]}"}
```

### 2) The task was initially a valid blocked-contract repair candidate

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts --dry-run
```

Observed result:

```json
{
  "dryRun": true,
  "treePath": "/app/projects/aks-rp-e2e.app/.state/tasks/tree.json",
  "repairedCount": 1,
  "unchangedCount": 127,
  "repaired": [
    "ops-escalate-blocked-missing-waiting-parity-20260708-alert3189"
  ]
}
```

### 3) Supported repair applied successfully

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts
```

Observed result:

```json
{
  "dryRun": false,
  "treePath": "/app/projects/aks-rp-e2e.app/.state/tasks/tree.json",
  "repairedCount": 1,
  "unchangedCount": 127,
  "repaired": [
    "ops-escalate-blocked-missing-waiting-parity-20260708-alert3189"
  ]
}
```

### 4) Live task readback now shows observer metadata present

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts show ops-escalate-blocked-missing-waiting-parity-20260708-alert3189
```

Observed blocker fields after repair:

- `blocker.waiting_for.type = evidence.available`
- `blocker.observed_by.workflow = project-planner`
- `blocker.observation_method = Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.`
- `blocker.next_check_at = 2026-07-08T20:15:00Z`
- `trace.blocked_contract_repaired_at = 2026-07-08T19:19:09.593Z`

### 5) Fresh recompute after repair still counts the same repaired task

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result after repair:

```json
{"measuredAt":1783538350813,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1,"sampleSize":1,"note":"{\"offenderTaskIds\":[\"ops-escalate-blocked-missing-waiting-parity-20260708-alert3189\"]}"}
```

### 6) Metric implementation path checked

`projects/aks-rp-e2e.app/scripts/project-metrics.ts` computes this metric through `taskCounts().blockedMissingObserverTaskIds`, which should only count blocked leaves that are missing one of:

- `blocker.observed_by`
- `blocker.observation_method`
- `blocker.next_check_at`

The repaired task now shows all three, so the metric recompute contradicts the live task readback.

## Durable outcome

The existing blocked escalation task remains the correct durable wait object for maintainer judgment:

- `ops-escalate-blocked-missing-waiting-parity-20260708-alert3189`

This triage adds explicit evidence that the sibling `missing-observer` alert is also part of the same sampler/task-tree parity defect, not a new independent blocked-leaf contract gap.

## Decision needed

App maintainer or human owner should decide whether:

1. the metric sampler is reading a stale or differently-shaped blocker object than `task-tree show` returns,
2. the repair path writes fields in a shape the sampler does not consistently consume,
3. or another app-local parity fix is required before the next metrics snapshot.

## Next validation

Validate on the next blocked-frontier review / metrics refresh after `2026-07-08T20:15:00Z`. Recovery requires either:

- a fresh recompute returning `value=0`, or
- a maintainer-confirmed parity fix/calibration that makes the metric sample and task-tree readback agree.
