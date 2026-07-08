# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` — alert `2982`

- Judged at: `2026-07-07T04:41:28Z`
- Chosen operation: `waiting_with_evidence`
- Metric owner: `aks-explorer`

## Judgment

The persisted metric row and open alert still show a breach (`current=1`), but the live authoritative metric recompute now returns `0`, the safe metric sampler also returns `0`, the runtime task-tree audit finds `0` blocked tasks missing observer metadata, and the supported blocked-contract repair dry-run reports `repairedCount=0`. That means there is no current blocked-holder observer defect for me to repair safely in this session. The concrete state change has already happened in the runtime tree; the truthful next step is to wait for the next runtime metrics refresh / alert lifecycle update to reconcile persisted state with live state.

## Evidence checked

### Persisted runtime metric row still breaching

```sql
SELECT id, current, threshold, target, priority, project, status, updated_at, alert_op
FROM metrics
WHERE id = 'aks-rp-e2e.process.blocked.missing-observer-count';
```

Observed row:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `project = aks-rp-e2e`
- `status = active`
- `updated_at = 1783425391239`
- `alert_op = >`

### Open alert row still unresolved

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE metric_id = 'aks-rp-e2e.process.blocked.missing-observer-count'
  AND resolved_at IS NULL
ORDER BY created_at DESC
LIMIT 10;
```

Observed row:

- `id = 2982`
- `resolved_at = NULL`
- message reports `current=1`

### Latest snapshots show flapping recent samples

Recent `metric_snapshots` rows:

- `1783425391239 => 1`
- `1783425074086 => 0`
- `1783424755930 => 1`
- `1783424435858 => 0`
- `1783424119631 => 0`
- `1783423787526 => 2`

### Live authoritative recompute is now healthy

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result:

```json
{ "measuredAt": 1783425624561, "value": 0 }
```

### Safe live sampler is also healthy

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result:

```json
{ "measuredAt": 1783425624646, "value": 0 }
```

### Direct runtime task-tree audit finds no current offender tasks

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun -e 'const fs=require("fs"); const obj=JSON.parse(fs.readFileSync(".state/tasks/tree.json","utf8")); const missing=[]; for (const [tid,t] of Object.entries(obj.tasks||{})) { if (t.state==="blocked") { const b=t.blocker||{}; if (!b.observed_by || !b.observation_method) missing.push(tid); } } console.log(JSON.stringify({blocked_missing_observer_count: missing.length, task_ids: missing}, null, 2));'
```

Observed result:

```json
{
  "blocked_missing_observer_count": 0,
  "task_ids": []
}
```

### Supported repair path finds nothing left to repair

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts --dry-run
```

Observed result:

- `repairedCount = 0`
- `unchangedCount = 102`
- no blocked holders needed observer-contract repair

## Conclusion

`waiting_with_evidence` is the correct operation because the live metric source has already recovered to `0`, there is no remaining supported blocked-contract repair to apply, and this session does not have a safe runtime write path to force-resolve the stale open alert row. The truthful next step is to wait for the next `metrics-snapshot` / alert refresh cycle to reconcile persisted state with live state.

## Next validation

Validate on the next `metrics-snapshot` or alert refresh cycle. Recovery is confirmed when the `metrics.current` row for `aks-rp-e2e.process.blocked.missing-observer-count` updates from `1` to `0` and alert `2982` resolves automatically.

If a later fresh recompute returns `>0`, reopen only with concrete offending blocked task ids from a fresh runtime-tree audit.
