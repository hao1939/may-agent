# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` — alert `3009`

- Judged at: `2026-07-07T13:14:49Z`
- Chosen operation: `fix_root_cause`
- Metric owner: `aks-explorer`

## Judgment

This alert was real at triage time. The persisted metric row showed `current=1`, and the live authoritative recompute, the safe metric sampler, and a direct runtime task-tree audit all agreed the current runtime tree actually had blocked holders missing required observer metadata. The supported safe repair path (`repair-blocked-contracts`) found and backfilled the exact offenders, and both live metric recomputes returned `0` immediately afterward. Because the owner could safely correct the live blocked-contract defect directly, the correct final operation is `fix_root_cause`.

## Evidence checked

### 1. Persisted metric row was breaching

```sql
SELECT id, status, priority, project, owner, current, threshold, target, updated_at, alert_op, source_command, config
FROM metrics
WHERE id = 'aks-rp-e2e.process.blocked.missing-observer-count';
```

Observed row:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`
- `updated_at = 1783433821092`
- `owner = aks-explorer`

### 2. Open alert row was unresolved

```sql
SELECT id, metric_id, alert_type, message, created_at, resolved_at
FROM metric_alerts
WHERE id = 3009;
```

Observed row:

- `resolved_at = NULL`
- message reports `current=1`

### 3. Live recompute confirmed the breach before repair

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result before repair:

```json
{ "measuredAt": 1783434070526, "value": 2 }
```

### 4. Safe metric sampler also confirmed the breach before repair

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result before repair:

```json
{ "measuredAt": 1783434070371, "value": 2 }
```

### 5. Direct runtime task-tree audit identified the exact current offenders

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun -e 'const fs=require("fs"); const obj=JSON.parse(fs.readFileSync(".state/tasks/tree.json","utf8")); const missing=[]; for (const [tid,t] of Object.entries(obj.tasks||{})) { if (t.state==="blocked") { const b=t.blocker||{}; if (!b.observed_by || !b.observation_method || !b.next_check_at) missing.push({task_id:tid, observed_by:b.observed_by??null, observation_method:b.observation_method??null, next_check_at:b.next_check_at??null}); } } console.log(JSON.stringify({blocked_missing_observer_count: missing.length, task_ids: missing}, null, 2));'
```

Observed result before repair:

```json
{
  "blocked_missing_observer_count": 2,
  "task_ids": [
    {
      "task_id": "hold-compact-windows-eligibility-frontier-20260707",
      "observed_by": null,
      "observation_method": null,
      "next_check_at": null
    },
    {
      "task_id": "hold-compact-workload-autoscaler-eligibility-frontier-20260707",
      "observed_by": null,
      "observation_method": null,
      "next_check_at": null
    }
  ]
}
```

### 6. Supported repair path backfilled the exact blocked holders

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree -- repair-blocked-contracts
```

Observed result:

- `repairedCount = 2`
- repaired:
  - `hold-compact-windows-eligibility-frontier-20260707`
  - `hold-compact-workload-autoscaler-eligibility-frontier-20260707`

### 7. Repaired holders now carry explicit observer metadata

Observed blocker excerpts after repair:

- `hold-compact-windows-eligibility-frontier-20260707`
  - `observed_by.workflow = project-planner`
  - `observation_method = Scheduled blocked-frontier owner review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.`
  - `next_check_at = 2026-07-07T14:31:19.857Z`
- `hold-compact-workload-autoscaler-eligibility-frontier-20260707`
  - `observed_by.workflow = project-planner`
  - `observation_method = Scheduled blocked-frontier owner review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.`
  - `next_check_at = 2026-07-07T14:31:19.857Z`

### 8. Live metric recomputes returned to healthy immediately after repair

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result after repair:

```json
{ "measuredAt": 1783434089820, "value": 0 }
```

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result after repair:

```json
{ "measuredAt": 1783434089713, "value": 0 }
```

## Conclusion

`fix_root_cause` is the correct final operation because the current runtime tree really did contain blocked holders missing the observer contract, the owner had a supported safe repair path, that repair was applied successfully, and live metric recomputes returned to `0` immediately afterward.

## Next validation

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-observer-count`. Recovery is confirmed when the persisted `metrics.current` row updates from `1` to `0` and alert `3009` resolves automatically. If a fresh recompute later returns `>0`, reopen only with concrete offender task ids from a fresh runtime-tree audit.
