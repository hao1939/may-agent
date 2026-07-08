# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` — alert `2986`

- Judged at: `2026-07-07T04:41:28Z`
- Chosen operation: `waiting_with_evidence`
- Metric owner: `aks-explorer`

## Judgment

The persisted metric row and open alert still show a breach (`current=2`, threshold `0`), but the live metric recompute is already healthy, the supported metric sampler also returns `0`, a direct runtime task-tree audit finds `0` blocked tasks missing observer metadata, and the supported blocked-contract repair dry-run reports `repairedCount=0`. That means there is no current blocked-holder observer defect I can safely fix in this session. The truthful action is to leave durable evidence and wait for the next runtime metrics refresh / alert lifecycle update to reconcile persisted state with live state.

## Evidence checked

### 1. Persisted metric row is still breaching

```sql
SELECT id, current, threshold, target, priority, project, status, updated_at, alert_op
FROM metrics
WHERE id = 'aks-rp-e2e.process.blocked.missing-observer-count';
```

Observed row:

- `current = 2`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `project = aks-rp-e2e`
- `status = active`
- `updated_at = 1783426029266`
- `alert_op = >`

### 2. Open alert row is unresolved

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE metric_id = 'aks-rp-e2e.process.blocked.missing-observer-count'
  AND resolved_at IS NULL
ORDER BY created_at DESC
LIMIT 10;
```

Observed row:

- `id = 2986`
- `resolved_at = NULL`
- message reports `current=2`

### 3. Recent snapshots show flapping persisted samples

Recent `metric_snapshots` rows:

- `1783426029266 => 2`
- `1783425709180 => 0`
- `1783425391239 => 1`
- `1783425074086 => 0`
- `1783424755930 => 1`
- `1783424435858 => 0`
- `1783424119631 => 0`
- `1783423787526 => 2`

### 4. Live authoritative recompute is healthy now

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result:

```json
{ "measuredAt": 1783426288856, "value": 0 }
```

### 5. Safe live sampler is also healthy

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result:

```json
{ "measuredAt": 1783426288989, "value": 0 }
```

### 6. Direct runtime task-tree audit finds no current offender tasks

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

### 7. Supported repair path finds nothing left to repair

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts --dry-run
```

Observed result:

- `dryRun = true`
- `repairedCount = 0`
- `unchangedCount = 105`
- no blocked holders needed observer-contract repair

## Conclusion

`waiting_with_evidence` is the correct final operation because the live metric source has already recovered to `0`, there is no remaining supported blocked-contract repair to apply, and this triage environment does not provide a safe runtime write path to clear the stale persisted metric / alert rows directly. The concrete change from this session is a new durable evidence note for alert `2986`; the next validation signal should come from the next `metrics-snapshot` / alert refresh cycle.

## Next validation

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-observer-count`. Recovery is confirmed when the `metrics.current` row updates from `2` to `0` and alert `2986` resolves automatically. If a fresh recompute later returns `>0`, reopen only with concrete offending blocked task ids from a fresh runtime-tree audit.
