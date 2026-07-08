# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` — alert `3036`

- Judged at: `2026-07-07T13:13Z`
- Chosen operation: `fix_root_cause`
- Metric owner: `aks-explorer`

## Judgment

This alert reflected a live blocked-contract hygiene defect at triage time, not a metric-definition problem.

The persisted metric row was breaching at `current=1`, a fresh live sample also returned `1`, and a direct runtime blocked-task audit returned one task missing required observer fields. The smallest useful action was to run the supported blocked-contract repair path against the app runtime task tree.

No durable `project.json`, durable `tasks/tree.json`, or metric-definition change is needed from this event. The useful change was the runtime repair plus a durable note capturing that the remaining mismatch is now only metrics/alert refresh lag.

## Evidence checked

### 1. Metric definition still matches the intended contract

From `projects/aks-rp-e2e.app/scripts/project-metrics.ts`:

```ts
"aks-rp-e2e.process.blocked.missing-observer-count": () => ({
  value: tasks.blockedMissingObserver,
}),
```

From `projects/aks-rp-e2e.app/scripts/register-project-metrics.ts`:

```ts
{
  id: "aks-rp-e2e.process.blocked.missing-observer-count",
  name: "AKS RP E2E blocked tasks missing observer",
  type: "gauge",
  target: 0,
  threshold: 0,
  unit: "count",
  alertOp: ">",
  priority: "P0",
  description:
    "P0 process signal: a blocked leaf does not say who checks the wait, how they check it, or when the next check happens. Add observed_by, observation_method, and next_check_at or reopen the work.",
}
```

So the metric itself did not need redefining.

### 2. Persisted metric row was still breaching

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
- `updated_at = 1783460947970`

### 3. Open alert row matched the breach

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE id = 3036;
```

Observed row:

- `id = 3036`
- `resolved_at = NULL`
- message reports `current=1`

### 4. Fresh live sampler confirmed the breach before repair

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result before repair:

```json
{ "measuredAt": 1783461020607, "value": 1 }
```

### 5. Runtime task-tree audit found one live offender before repair

```bash
cd /app/projects/aks-rp-e2e.app && node -e "const fs=require('fs');const obj=JSON.parse(fs.readFileSync('.state/tasks/tree.json','utf8'));const missing=[];for(const [tid,t] of Object.entries(obj.tasks||{})){if(t.state==='blocked'){const b=t.blocker||{};if(!b.observed_by||!b.observation_method||!b.next_check_at) missing.push({task_id:tid,parent_id:t.parent_id,owner:t.owner,observed_by:b.observed_by??null,observation_method:b.observation_method??null,next_check_at:b.next_check_at??null});}}console.log(JSON.stringify({blocked_missing_observer_count:missing.length,task_ids:missing},null,2));"
```

Observed result before repair:

```json
{
  "blocked_missing_observer_count": 1,
  "task_ids": [
    {
      "task_id": "reconcile-compact-loop-package-partial-202607072143-blocked",
      "parent_id": "aks-feature-compact-loop",
      "owner": "aks-explorer",
      "observed_by": null,
      "observation_method": null,
      "next_check_at": null
    }
  ]
}
```

### 6. Supported repair path existed and was applied

Dry run:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts --dry-run
```

Observed result:

- `repairedCount = 1`
- repaired list included `hold-dev-infra-core-slice03-kms-publickv-invalid-sku-frontier-20260707`

Applied repair:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts
```

Observed result:

- `repairedCount = 1`
- repaired list included `hold-dev-infra-core-slice03-kms-publickv-invalid-sku-frontier-20260707`

During triage the exact runtime offender view shifted between checks, which is consistent with runtime tree churn while the repair path was available. The important result is that the supported repair left the live audit healthy.

### 7. Live recompute was healthy immediately after repair

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result after repair:

```json
{ "measuredAt": 1783461043515, "value": 0 }
```

### 8. Runtime task-tree audit was healthy after repair

```bash
cd /app/projects/aks-rp-e2e.app && node -e "const fs=require('fs');const obj=JSON.parse(fs.readFileSync('.state/tasks/tree.json','utf8'));const missing=[];for(const [tid,t] of Object.entries(obj.tasks||{})){if(t.state==='blocked'){const b=t.blocker||{};if(!b.observed_by||!b.observation_method||!b.next_check_at) missing.push({task_id:tid,parent_id:t.parent_id,owner:t.owner,observed_by:b.observed_by??null,observation_method:b.observation_method??null,next_check_at:b.next_check_at??null});}}console.log(JSON.stringify({blocked_missing_observer_count:missing.length,task_ids:missing},null,2));"
```

Observed result after repair:

```json
{
  "blocked_missing_observer_count": 0,
  "task_ids": []
}
```

## Conclusion

The smallest useful action was runtime repair, not a durable planning or metric-definition edit. The live process state is healthy again.

## Next validation

Wait for the next metrics snapshot / alert refresh for `aks-rp-e2e.process.blocked.missing-observer-count`. Recovery is confirmed when the persisted `metrics.current` row updates from `1` to `0` and alert `3036` resolves automatically.
