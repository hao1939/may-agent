# Metric alert triage — aks-rp-e2e.process.blocked.missing-waiting-for-count

- Alert id: `2884`
- Metric id: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Judged at: `2026-07-07T06:08:00Z`
- Chosen operation: `upgrade_or_escalate`

## Judgment

This alert is no longer a straightforward blocked-task contract repair. A real offender existed at the start of triage, and the supported repair path was applied, but the metric sampler still reports `value=1` even after every direct blocked-leaf audit shows `0` leaves missing `blocker.waiting_for` in both the runtime tree and the committed tree.

That is now a contradiction between the metric signal and the directly inspected task-tree state. Under the metric-alert manual, this requires escalation because the owner cannot safely prove whether the metric implementation or the sampled runtime source is wrong.

## Evidence checked

### 1) Live metric sample still breaching

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-waiting-for-count --json
```

Observed result:

```json
{ "measuredAt": 1783404083976, "value": 1 }
```

### 2) Supported dry-run initially found one repairable offender

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts --dry-run
```

Observed result before repair:

```json
{
  "dryRun": true,
  "repairedCount": 1,
  "repaired": [
    "hold-spec-traffic-alb-controller-cleanup-authority-gap-20260707"
  ]
}
```

### 3) Supported repair path was applied

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts
```

Observed result:

```json
{
  "dryRun": false,
  "repairedCount": 1,
  "repaired": [
    "hold-spec-traffic-alb-controller-cleanup-authority-gap-20260707"
  ]
}
```

### 4) The repaired runtime task now has structured `waiting_for`

Readback from `.state/tasks/tree.json` for `hold-spec-traffic-alb-controller-cleanup-authority-gap-20260707` shows:

```json
"waiting_for": {
  "type": "evidence.available",
  "taskId": "hold-spec-traffic-alb-controller-cleanup-authority-gap-20260707"
}
```

### 5) After repair, supported dry-run reports no remaining missing-waiting repairs

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts --dry-run
```

Observed result after repair:

```json
{
  "dryRun": true,
  "repairedCount": 0,
  "unchangedCount": 80,
  "repaired": []
}
```

### 6) Direct blocked-leaf audits now show zero missing wait targets

Runtime tree audit:

```json
{
  "blockedLeaves": 80,
  "missingCount": 0,
  "ids": []
}
```

Committed `tasks/tree.json` audit:

```json
{
  "blockedLeaves": 127,
  "missingCount": 0,
  "ids": []
}
```

### 7) A Bun read using the same `readTaskTree(taskTreeConfig(...))` path as the metric code also returns zero missing waiters

Observed result:

```json
{
  "blockedLeaves": 80,
  "missingCount": 0,
  "ids": []
}
```

## Escalation needed

A maintainer should decide which of these is wrong:

1. `scripts/project-metrics.ts` sampling path for `aks-rp-e2e.process.blocked.missing-waiting-for-count`, or
2. the runtime/source selection used by that script when invoked through `bun run`.

No further blocked-leaf churn is justified until the sampler and direct tree audit converge on the same count.

## Requested next action

- Reproduce the contradiction with the exact commands above.
- Instrument or review `scripts/project-metrics.ts` around `taskCounts().blockedMissingWaitingFor` and its `loadTaskTree()` source selection.
- Only after sampler/direct-audit convergence should the alert be resolved or further task-tree repair work be opened.

## Next validation signal

Next owner or maintainer check after instrumentation of `scripts/project-metrics.ts`, or the next `metrics-snapshot` once sampler/direct-audit convergence is restored.
