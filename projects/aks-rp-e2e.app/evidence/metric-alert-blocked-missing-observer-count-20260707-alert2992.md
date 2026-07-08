# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` — alert `2992`

- Judged at: `2026-07-07T04:41:28Z`
- Chosen operation: `waiting_with_evidence`
- Metric owner: `aks-explorer`

## Judgment

The persisted metric row and open alert still show a breach (`current=1`, threshold `0`), but the live authoritative recompute is already healthy, the supported metric sampler also returns `0`, the runtime task-tree audit finds `0` blocked tasks missing observer metadata, and the supported blocked-contract repair dry run reports `repairedCount=0`. There is no current blocked-holder observer defect that I can safely repair in this session. The truthful next step is to wait for the next runtime metrics refresh / alert lifecycle update to reconcile persisted alert state with the already-healthy live task-tree state.

## Evidence checked

### 1. Persisted metric row still breaching

```sql
SELECT id, current, threshold, target, priority, status, updated_at
FROM metrics
WHERE id = 'aks-rp-e2e.process.blocked.missing-observer-count';
```

Observed row:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`
- `updated_at = 1783427616038`

### 2. Open alert row still unresolved

```sql
SELECT id, metric_id, alert_type, message, created_at, resolved_at
FROM metric_alerts
WHERE id = 2992;
```

Observed row:

- `id = 2992`
- `resolved_at = NULL`
- message reports `current=1`

### 3. Live authoritative recompute is healthy

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result:

```json
{ "measuredAt": 1783427919923, "value": 0 }
```

### 4. Safe metric sampler is also healthy

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result:

```json
{ "measuredAt": 1783427919669, "value": 0 }
```

### 5. Direct runtime task-tree audit finds no current offenders

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun -e 'const fs=require("fs"); const obj=JSON.parse(fs.readFileSync(".state/tasks/tree.json","utf8")); const missing=[]; for (const [tid,t] of Object.entries(obj.tasks||{})) { if (t.state==="blocked") { const b=t.blocker||{}; if (!b.observed_by || !b.observation_method || !b.next_check_at) missing.push({task_id:tid, observed_by:b.observed_by??null, observation_method:b.observation_method??null, next_check_at:b.next_check_at??null}); } } console.log(JSON.stringify({blocked_missing_observer_count: missing.length, task_ids: missing}, null, 2));'
```

Observed result:

```json
{
  "blocked_missing_observer_count": 0,
  "task_ids": []
}
```

### 6. Supported repair path finds nothing left to repair

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree -- repair-blocked-contracts --output .state/tasks/tree.json --dry-run
```

Observed result:

- `repairedCount = 0`
- `unchangedCount = 103`
- no blocked holders needed observer-contract repair

## Conclusion

`waiting_with_evidence` is the correct final operation because the live source of truth is already back in range, there is no safe root-cause repair left to apply now, and this triage environment does not provide a safe runtime write path to clear the stale alert row directly.

## Next validation

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-observer-count`. Recovery is confirmed when the persisted `metrics.current` row updates from `1` to `0` and alert `2992` resolves automatically. If a fresh recompute later returns `>0`, reopen only with concrete offending blocked task ids from a fresh runtime-tree audit.
