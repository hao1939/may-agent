# Metric alert triage — `aks-rp-e2e.process.integrity.task-tree-problem-count` (alert 4073)

- Judged at: 2026-07-17T17:50:00Z
- Metric id: `aks-rp-e2e.process.integrity.task-tree-problem-count`
- Alert id: `4073`
- Chosen operation: `resolve_stale`

## Why this is stale

The persisted metric row and unresolved alert still reflect an earlier `current = 1` breach, but a fresh live recompute against the current task tree already returns `0`, the paired assignment-state mismatch metric also returns `0`, and the integrity audit is green. The alert is therefore lagging behind the already-recovered source-of-truth state.

## Evidence checked

### Persisted metric row still breaching

```sql
SELECT id, name, current, threshold, target, priority, project, source, source_command, updated_at
FROM metrics
WHERE id = 'aks-rp-e2e.process.integrity.task-tree-problem-count';
```

Result:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1784336535418`
- `source_command = bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count`

### Open alert row is still unresolved

```sql
SELECT id, metric_id, message, resolved_at, created_at
FROM metric_alerts
WHERE id = 4073;
```

Result:

- `resolved_at = NULL`
- `message = AKS RP E2E task tree integrity problems is above threshold: current=1, threshold=0, target=0`

### Recent snapshots show a temporary breach window

Latest persisted snapshots before this judgment:

- `1784336535418 -> 1`
- `1784336217810 -> 1`
- `1784335898912 -> 1`
- earlier samples from `1784335579331` backward were `0`

### Fresh live recompute is already healthy

```bash
cd /app/projects/aks-rp-e2e.app && bun ./scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count --json
```

Result:

```json
{"measuredAt":1784336904861,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

### Underlying contributing metric also recovered

`task-tree-problem-count` is defined in `scripts/project-metrics.ts` as `(roots === 1 ? 0 : 1) + assignmentStateMismatch`. A direct resample of the contributing assignment-state mismatch metric now returns `0` with no offenders:

```bash
cd /app/projects/aks-rp-e2e.app && bun ./scripts/project-metrics.ts aks-rp-e2e.process.assignment-state-mismatch-count --json
```

Result:

```json
{"measuredAt":1784336904613,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"mismatches\":[]}"}
```

### Integrity audit passes

```bash
cd /app/projects/aks-rp-e2e.app && bun ./scripts/check-integrity.ts
```

Result:

- `App integrity OK: aks-rp-e2e owner=aks-explorer workflows=15 tasks=137`
- only existing warnings remained; no integrity failure was reported.

### Recent owner sessions likely closed the transient cause

Since the alert fired, app-ops completed:

- `s_project_planner_event_review_20260718010212_6nkwpx` (`done`)
- `s_project_planner_planning_update_20260718010212_ptedwi` (`done`)
- `s_task_ops-apply-ccp-autoupgrader-pipeline-459172-owner-handoff-holder-refresh-20260718_line-459172-owner-handoff-holder-refresh-20260718_20260718010502` (`done`)
- `s_task_ops-apply-repair-orphaned-project-task-pair-restore-network-cni-npm-uninstall-20260718-state-rep_e-network-cni-npm-uninstall-20260718-state-repair_20260718010539` (`done`)

That timing aligns with the fresh `assignment-state-mismatch-count = 0` recompute.

## Judgment

Choosing `resolve_stale` because the live source of truth has already recovered to `0` and the open alert row is lagging behind the latest repair/recompute state.

I do not have a safe runtime write path in this workflow to manually resolve `metric_alerts`, so the concrete durable change from this session is this evidence record. The next `metrics-snapshot` / alert reconciliation should bring the persisted row back into sync and auto-close the alert lifecycle.

## Next validation

- Wait for the next `metrics-snapshot` / alert refresh.
- Expected outcome: `metrics.current` for `aks-rp-e2e.process.integrity.task-tree-problem-count` becomes `0` and alert `4073` is resolved automatically.
