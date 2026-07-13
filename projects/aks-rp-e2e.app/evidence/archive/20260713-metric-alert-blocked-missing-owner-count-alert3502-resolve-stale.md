# Metric alert triage — `aks-rp-e2e.process.blocked.missing-owner-count` (alert 3502)

- Date: 2026-07-13
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.blocked.missing-owner-count`
- Alert id: `3502`
- Owner: `app-ops`

## Judgment

This alert is stale now.

The persisted metric row and open alert still show a breach at `current = 1`, but the current blocked task called out by the latest snapshot already has `blocker.owner = "app-ops"`, and a fresh owner-side recompute of the metric now returns `0` offenders.

## Evidence checked

### Persisted metric row still shows the breach

Runtime DB inspection showed:

- `metrics.current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- open alert `metric_alerts.id = 3502` with `resolved_at = null`

Latest stored snapshot still points to one offender:

- `value = 1`
- `sample_size = 1`
- `note = {"offenderTaskIds":["ops/wait-project-approval-owner-return-primary-blocker-20260713"]}`

### Live task tree no longer matches the breach

The current task entry at `.state/tasks/tree.json` for `ops/wait-project-approval-owner-return-primary-blocker-20260713` now includes:

- `blocker.owner = "app-ops"`
- a populated `condition`
- `waiting_for`
- `observed_by`
- `observation_method`
- `next_check_at`
- `resume_condition`
- `fallback_at`
- `fallback_action`

So the blocked leaf no longer lacks an owner.

### Metric implementation confirms the alert only counts missing blocker owners

`project-metrics.ts` defines the metric as the count of blocked leaf tasks where `task.blocker.owner` is missing:

```ts
const blockedMissingOwnerTaskIds = blockedLeafTasks.flatMap((task, index) => {
  const blocker = recordValue(task.blocker);
  return !stringRecordField(blocker, ["owner"])
    ? [taskIdOrFallback(task, index)]
    : [];
});
```

### Fresh owner-side recompute is back in range

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-owner-count --json
```

Observed:

```json
{"measuredAt":1783922948810,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

A sibling recompute for `aks-rp-e2e.process.blocked.missing-observer-count` also now returns `0`, which matches the current blocker shape.

## Why this is `resolve_stale`

- The metric contract is still correct: blocked leaves should carry a blocker owner.
- The current live task tree now satisfies that contract for the previously named offender.
- A fresh direct recompute returns `0`, so the persisted alert is lagging current runtime state rather than describing an active missing-owner failure.
- This triage environment has no safe runtime write path to manually resolve `metric_alerts`, so the correct action here is to record the stale-state judgment and validate on the next supported metrics refresh.

## Next validation

Wait for the next `metrics-snapshot` / alert refresh for `aks-rp-e2e.process.blocked.missing-owner-count`.

Expected recovery signal:

- recomputed metric remains `0`
- `metrics.current` refreshes from `1` to `0`
- alert `3502` resolves automatically
