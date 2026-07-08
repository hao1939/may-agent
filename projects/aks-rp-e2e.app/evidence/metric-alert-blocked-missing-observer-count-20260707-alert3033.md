# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` — alert `3033`

- Judged at: `2026-07-07T21:05Z`
- Chosen operation: `fix_root_cause`
- Metric owner: `aks-explorer`

## Judgment

This alert was real at triage time. The persisted metric row and alert were breaching at `current=1`, the live metric sampler also returned `1`, and a direct runtime task-tree audit found one blocked task missing observer metadata: `reconcile-compact-loop-package-partial-unsampled-20260707-followup-block`.

The smallest useful action was the supported runtime repair path:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts
```

That repair patched the blocked-contract metadata in the runtime tree and immediately cleared the live recompute to `0`. No metric-definition change or durable task-tree redesign is needed for this specific alert; only the normal metrics snapshot / alert refresh now remains to reconcile the persisted row.

## Evidence checked

### 1. Persisted metric row was breaching

```sql
SELECT id, current, threshold, target, status, updated_at, alert_op
FROM metrics
WHERE id = 'aks-rp-e2e.process.blocked.missing-observer-count';
```

Observed row during triage:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `status = active`
- `alert_op = >`
- `updated_at = 1783458247070`

### 2. Open alert row matched the breach

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE id = 3033;
```

Observed row:

- `id = 3033`
- `resolved_at = NULL`
- message reports `current=1`

### 3. Live sampler confirmed the breach before repair

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result before repair:

```json
{ "measuredAt": 1783458323522, "value": 1 }
```

### 4. Runtime task-tree audit named the live offender

Command:

```bash
cd /app/projects/aks-rp-e2e.app && node -e "const fs=require('fs');const obj=JSON.parse(fs.readFileSync('.state/tasks/tree.json','utf8'));const missing=[];for(const [tid,t] of Object.entries(obj.tasks||{})){if(t.state==='blocked'){const b=t.blocker||{};const obs=t.observer||b.observed_by;if(!obs) missing.push({task_id:tid,parent_id:t.parent_id,owner:t.owner});}}console.log(JSON.stringify({blocked_missing_observer_count:missing.length,task_ids:missing},null,2));"
```

Observed result before repair:

```json
{
  "blocked_missing_observer_count": 1,
  "task_ids": [
    {
      "task_id": "reconcile-compact-loop-package-partial-unsampled-20260707-followup-block",
      "parent_id": "aks-feature-compact-loop",
      "owner": "aks-explorer"
    }
  ]
}
```

### 5. Supported repair path found and applied the blocked-contract fix

Dry run:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts --dry-run
```

Observed result:

- `repairedCount = 2`
- includes `reconcile-compact-loop-package-partial-unsampled-20260707-followup-block`
- includes `hold-dev-infra-core-slice03-kms-publickv-invalid-sku-frontier-20260707`

Applied repair:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts
```

Observed result:

- `repairedCount = 2`
- same two task ids repaired in runtime state

### 6. Live recompute was healthy immediately after repair

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result after repair:

```json
{ "measuredAt": 1783458335366, "value": 0 }
```

### 7. Runtime task-tree audit is now healthy

Command:

```bash
cd /app/projects/aks-rp-e2e.app && node -e "const fs=require('fs');const obj=JSON.parse(fs.readFileSync('.state/tasks/tree.json','utf8'));const missing=[];for(const [tid,t] of Object.entries(obj.tasks||{})){if(t.state==='blocked'){const b=t.blocker||{};const obs=t.observer||b.observed_by;if(!obs) missing.push(tid);}}console.log(JSON.stringify({blocked_missing_observer_count:missing.length,task_ids:missing},null,2));"
```

Observed result after repair:

```json
{
  "blocked_missing_observer_count": 0,
  "task_ids": []
}
```

## Conclusion

`fix_root_cause` was the correct smallest action: the runtime blocked-contract repair directly removed the live missing-observer defect. The remaining mismatch is only persisted alert/metric lag.

## Next validation

Wait for the next metrics snapshot / alert refresh for `aks-rp-e2e.process.blocked.missing-observer-count`. Recovery is confirmed when the persisted `metrics.current` row updates from `1` to `0` and alert `3033` resolves automatically.
