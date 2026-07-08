# Metric alert triage — `aks-rp-e2e.process.blocked.missing-waiting-for-count` (alert 3038)

- Alert id: `3038`
- Event type: `metric.breach`
- Metric id: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Judged at: `2026-07-07T13:13:10Z`
- Chosen operation: `upgrade_or_escalate`
- Metric owner: `aks-explorer`

## Judgment

This alert does **not** justify another task-tree edit. Fresh direct audits of both the committed task tree and the runtime task tree found `0` blocked leaf tasks missing `blocker.waiting_for`, but the official metric sampler command still returned `{"value":1}`.

That means the smallest useful owner action is to leave durable contradiction evidence and avoid churning the tree or metric definition blindly. The project/task tree stays unchanged unless a future audit names a real blocked leaf offender.

## Evidence checked

### 1. The official metric sampler still reports a breach

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-waiting-for-count --json
```

Observed result:

```json
{ "measuredAt": 1783463146429, "value": 1 }
```

### 2. Direct audit of the committed task tree found no offenders

Audit result from `projects/aks-rp-e2e.app/tasks/tree.json`:

```text
COUNT 0
```

The audit checked only blocked leaf tasks and treated a task as compliant when `blocker.waiting_for` or `blocker.waitingFor` was a structured object.

### 3. Direct audit of the runtime task tree also found no offenders

Audit result from `projects/aks-rp-e2e.app/.state/tasks/tree.json`:

```text
EXISTS
COUNT 0
```

### 4. An in-process Bun audit using the same task-tree config path also returned zero

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun -e '...readTaskTree(taskTreeConfig(...))...'
```

Observed result:

```json
{
  "count": 0,
  "ids": [],
  "sample": []
}
```

So the contradiction is now specifically between the metric sampler command and every direct blocked-leaf audit path checked during this review.

## Why no tree or metric-definition edit is useful now

- **No task-tree repair is justified**: both committed and runtime trees are already compliant for this contract.
- **No metric-definition edit is justified**: `scripts/project-metrics.ts` still defines this metric as `tasks.blockedMissingWaitingFor`, which matches the intended rule.
- **No owner-context memory update is needed**: this is another same-day contradiction instance, already well represented by durable evidence files for this metric family.

## Decision

Leave the project/task tree and metric definition unchanged.

Treat this alert as a sampler/runtime contradiction until one of these happens:

1. a future fresh direct audit names a real blocked leaf missing `waiting_for`, or
2. a maintainer reproduces and fixes the divergence between `bun run ./scripts/project-metrics.ts ...` and the direct task-tree audit.

## Next validation signal

Recheck only on the next refresh for `aks-rp-e2e.process.blocked.missing-waiting-for-count`.

- If the value returns to `0`, treat this alert as transient sampler drift.
- If it stays `>0` while direct audits remain `0`, escalate sampler drift again rather than editing blocked tasks blindly.
