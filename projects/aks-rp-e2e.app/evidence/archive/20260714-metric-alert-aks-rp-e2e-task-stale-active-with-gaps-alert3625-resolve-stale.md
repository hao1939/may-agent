# Metric alert triage — resolve_stale — `aks-rp-e2e.task.stale-active-with-gaps`

- Date: 2026-07-14
- Metric id: `aks-rp-e2e.task.stale-active-with-gaps`
- Alert id: `3625`
- Owner: `app-ops`
- Final operation: `resolve_stale`

## Judgment

This alert row is stale relative to current live task-tree state.

The persisted runtime metric row and open alert still show a breach (`current=1`,
`resolved_at=null`), but a fresh direct recompute now returns `value=0`, the
frontier now has only one active task, and the four previously stale active
leaves have moved to `review` with no stale active task ids remaining.

So there is no live stale-active condition left for app-ops to repair. The next
metrics snapshot should rewrite the persisted metric/alert state to match the
already-recovered task tree.

## Evidence checked

### 1) Persisted runtime state still shows the stale breach

Runtime `metrics` row at triage time:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1784014727791`

Open alert row at triage time:

- `metric_alerts.id = 3625`
- `resolved_at = null`
- `created_at = 1784014492238`

Recent snapshots still persisted the stale value twice:

- `1784014727791 => 1`
- `1784014426358 => 1`
- previous sample `1784014118752 => 0`

### 2) Fresh live recompute now reports recovery

```bash
cd /app/projects/aks-rp-e2e.app && \
  bun run ./scripts/project-metrics.ts aks-rp-e2e.task.stale-active-with-gaps --json
```

Result:

```json
{"measuredAt":1784014864388,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

That means the source-of-truth task tree no longer contains a stale active leaf
while verification gaps remain.

### 3) Unowned-work detail confirms stale active task ids are gone

```bash
cd /app/projects/aks-rp-e2e.app && \
  bun run ./scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json
```

Result excerpt:

```json
{
  "value": 0,
  "sampleSize": 0,
  "note": "{\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"staleWorkflowRuns\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"
}
```

### 4) The four previously stale active leaves have already advanced to review

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts frontier
```

Current frontier excerpt:

- `active`:
  - `ops/reconcile-cluster-autoscaler-overdue-spec-frontier-family-20260714`
- `review`:
  - `ops/normalize-secops-fips-pending-family-frontier-20260714`
  - `ops/reconcile-project-approval-primary-blocker-vs-focus-split-20260714`
  - `ops/reconcile-shared-jwt-authenticator-wait-vs-terminal-model-20260714`
  - `ops/repair-localdns-compact-frontier-projection-drift-20260714`

So the four tasks that had been reported as stale-active earlier are no longer
active at all.

## Why this is `resolve_stale`

- The persisted alert/metric state still says `1`, but live recompute says `0`.
- The live frontier no longer has the four stale active leaves.
- Unowned-work detail shows `staleActiveTaskIds = []`.
- There is no current safe runtime write path in this session to directly close
  `metric_alerts`, so the right action is to document the stale row and accept
  the next metrics snapshot as validator.

## Next validation

Accept the next `metrics-snapshot` / metric resample as validator. It should:

1. rewrite `aks-rp-e2e.task.stale-active-with-gaps.current` from `1` to `0`, and
2. resolve alert `3625` as recovered/stale.

If a later direct recompute returns `1` again, that would be a fresh stale-active
breach rather than unfinished work from alert `3625`.
