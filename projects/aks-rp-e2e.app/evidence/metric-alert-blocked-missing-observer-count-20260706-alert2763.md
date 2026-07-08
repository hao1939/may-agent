# Metric alert triage — aks-rp-e2e.process.blocked.missing-observer-count

- Alert id: `2763`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Judged at: `2026-07-06T02:27:50Z`
- Chosen operation: `fix_root_cause`

## Judgment

This was a real blocked-contract defect in the live runtime task tree, not just a noisy alert.
The metric sampler reads the runtime tree at `.state/tasks/tree.json`, and the live runtime tree had one blocked leaf missing the required observer contract fields. The safe repair path was to backfill the blocked contract through the app task-tree tool, not to edit the DB.

## Evidence checked

### Persisted runtime state before repair

Runtime DB still showed the alert as open and the metric row as breaching:

- `metrics.current = 1`
- open unresolved alert row `2763`

### Live runtime tree was the source of truth

Direct inspection of `.state/tasks/tree.json` showed one blocked leaf missing observer metadata before repair.

### Concrete fix applied

Command run:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts
```

Observed result:

- `repairedCount: 1`
- repaired task id: `hold-spec-loop-bootstrap-profile-byo-acr-contradiction-timeout-frontier-20260706b`

The repaired blocker now includes explicit blocked-wait contract fields including:

- `observed_by`
- `observation_method`
- `next_check_at`
- `fallback_at`
- `fallback_action`

### Validation after repair

Repeated metric samples after the repair returned to target:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count
```

Observed values on three consecutive runs:

- `0`
- `0`
- `0`

A direct recompute from `.state/tasks/tree.json` also returned:

```json
{
  "count": 0,
  "offenders": []
}
```

## Conclusion

`fix_root_cause` is the correct final operation because the live runtime task tree did contain a blocked leaf missing observer metadata, the safe task-tree repair path was applied, and the live metric sample is now back at `0`.

The persisted metric row and alert row are now lagging indicators. They should clear on the next `metrics-snapshot` / alert refresh cycle if the repaired runtime tree remains unchanged.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-observer-count`. If the sample remains `0`, alert `2763` should recover automatically. If it returns `>0`, reopen only with the concrete blocked task ids from a fresh `.state/tasks/tree.json` recompute.
