# Metric alert triage — fix_root_cause — `aks-rp-e2e.task.stale-active-with-gaps`

Date: 2026-07-14T06:07Z  
Alert id: `3607`  
Metric id: `aks-rp-e2e.task.stale-active-with-gaps`

## Judgment

Choose `fix_root_cause` because the breach was real at triage time: three domain leaves were still marked `active` after their worker sessions had already finished `done`, so the task tree was overstating live work while verification gaps still remained.

## Evidence checked before repair

### Persisted metric row still breaching

Runtime metric row before repair:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1784009155036`

Open alert row before repair:

- `metric_alerts.id = 3607`
- `resolved_at = null`
- `created_at = 1784009199002`

Direct recompute before repair also returned a live breach:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.task.stale-active-with-gaps --json
# => {"measuredAt":1784009222298,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1}
```

### Stale-active contributors were finished worker attempts left in `active`

`aks-rp-e2e.process.unowned-work-count` reported these stale active task ids before repair:

- `domain/rp-cluster-lifecycle-new-vnet-pass-writeback-surface-sync-20260714`
- `domain/localdns-residual-family-sync-and-holder-reduction-20260714`
- `domain/rp-nodepool-operations-row3-residual-holder-path-reconcile-20260714`

Each linked task-worker session had already ended `done`:

- `s_task_domain_rp-cluster-lifecycle-new-vnet-pass-writeback-surface-sync-20260714` → `status=done`
- `s_task_domain_localdns-residual-family-sync-and-holder-reduction-20260714` → `status=done`
- `s_task_domain_rp-nodepool-operations-row3-residual-holder-path-reconcile-20260714` → `status=done`

while `bun run ./scripts/task-tree.ts show <task-id>` still showed each task as `state=active` / `status=active`.

## Repair applied

I used the supported task-tree completion path to move the three stale leaves from `active` to `review` so planner/reviewer can continue from truthful state instead of carrying dead active slots:

```bash
bun run ./scripts/task-tree.ts complete domain/rp-cluster-lifecycle-new-vnet-pass-writeback-surface-sync-20260714 \
  --result done \
  --summary "Consumed reviewed run 171786657 into repo-local spec/model/path-summary/compact surfaces so rp-cluster-lifecycle new-vnet now renders as a reviewed pass and the remaining ready/no-live holder narrows to create-get-delete plus list-credentials."

bun run ./scripts/task-tree.ts complete domain/localdns-residual-family-sync-and-holder-reduction-20260714 \
  --result done \
  --summary "Reconciled the LocalDNS residual family across compact/spec loop surfaces, confirmed the checked-in five-member frontier plus two consumed pass-history members, and repaired the vm-prerelease enable-disable knowledge-map path to the accepted reviewed-pass posture."

bun run ./scripts/task-tree.ts complete domain/rp-nodepool-operations-row3-residual-holder-path-reconcile-20260714 \
  --result done \
  --summary "Reconciled the row-3 agentpool-operations repo-local posture so the accepted Linux VMSS ready-subset pass remains pass but non-final, while the only residual holder stays the exact lindel/linalo/windel/winalo set."
```

## State after repair

### Direct metric recompute recovered

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.task.stale-active-with-gaps --json
# => {"measuredAt":1784009256206,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

### No stale active task ids remain

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json
# => note.staleActiveTaskIds = []
```

### Frontier no longer carries those leaves as active

`bun run ./scripts/task-tree.ts frontier` now shows:

- `review` contains the three repaired tasks
- `active` no longer contains those task ids

## Remaining follow-through

The persisted metric row and alert have not recovered yet because the normal metrics snapshot cycle has not rewritten `metrics.current` / `metric_alerts` since the repair. The validator for this fix is the next snapshot showing `aks-rp-e2e.task.stale-active-with-gaps.current = 0` and eventual recovery of alert `3607`.
