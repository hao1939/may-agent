# Metric alert triage — fix_root_cause — `aks-rp-e2e.task.stale-active-with-gaps`

- Alert id: `3555`
- Metric id: `aks-rp-e2e.task.stale-active-with-gaps`
- Operation: `fix_root_cause`
- Date: 2026-07-13

## Judgment

The breach was real at triage time, but the stale-active leaves were not live worker attempts anymore. Two tasks still sat in `active` after their task-worker sessions had already finished successfully, so the task tree was overstating active work while verification gaps still remained.

## Evidence checked before repair

### Runtime metric still breaching

`bun run ./scripts/project-metrics.ts aks-rp-e2e.task.stale-active-with-gaps --json`

Returned:

```json
{"measuredAt":1783961116551,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1}
```

### Stale-active contributors were completed worker attempts left in `active`

`bun run ./scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json`

reported these stale active tasks before repair:

- `ops/repair-project-approval-owner-return-structured-wait-regression-20260713`
- `domain/apply-cluster-autoscaler-vm-prerelease-source-provenance-frontier-split-20260713`

with `restartReason: "session-not-running"`.

Direct session lookup confirmed both linked task-worker sessions were already terminal:

- `s_task_ops_repair-project-approval-owner-return-structured-wait-regression-20260713` → `status=done`
- `s_task_domain_apply-cluster-autoscaler-vm-prerelease-source-provenance-frontier-split-20260713` → `status=done`

while `bun run ./scripts/task-tree.ts show <task-id>` still showed both tasks as `state=active` / `status=active`.

## Repair applied

Instead of requeueing already-finished work, I used the supported task-tree completion path to move both stale leaves from `active` to `review` and attach their worker summaries/evidence so the reviewer/planner chain can continue truthfully:

```bash
bun run ./scripts/task-tree.ts complete ops/repair-project-approval-owner-return-structured-wait-regression-20260713 \
  --result done \
  --summary "Repaired the project approval owner-return wait shape, preserved the exact project.approval.submitted blocker contract, and added regression coverage so refreshBlockedWait keeps structured approval metadata." \
  --evidence "evidence/archive/ops-repair-project-approval-owner-return-structured-wait-regression-20260713.md"

bun run ./scripts/task-tree.ts complete domain/apply-cluster-autoscaler-vm-prerelease-source-provenance-frontier-split-20260713 \
  --result done \
  --summary "Applied the mounted-source VM-prerelease provenance split so compact outputs now preserve the e2ev3 suite-native quartet versus the e2ev2 overlay trio without changing blocked execution status or requesting a rerun." \
  --evidence "../aks-rp-e2e/evidence/archive/domain-apply-cluster-autoscaler-vm-prerelease-source-provenance-frontier-split-20260713.md"
```

## State after repair

### Task tree no longer claims those leaves are active

`bun run ./scripts/task-tree.ts frontier`

now reports:

- both repaired tasks under `review`
- no longer under `active`

### Metric direct recompute recovered

`bun run ./scripts/project-metrics.ts aks-rp-e2e.task.stale-active-with-gaps --json`

returned:

```json
{"measuredAt":1783961128361,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

## Remaining follow-through

`aks-rp-e2e.process.unowned-work-count` still reports the two leaves as assignment-state mismatches while they wait for reviewer/planner consumption in `review`, but `staleActiveTaskIds` is now empty. The validator for this alert is the next `metrics-snapshot` persisting `aks-rp-e2e.task.stale-active-with-gaps.current = 0` and eventual alert recovery for row `3555`.
