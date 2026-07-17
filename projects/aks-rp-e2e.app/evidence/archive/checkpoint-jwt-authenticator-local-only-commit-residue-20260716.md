# Checkpoint evidence — jwt-authenticator local-only commit residue

- Task: `ops/checkpoint-jwt-authenticator-local-only-commit-residue-20260716`
- Attempt: `a_ops_checkpoint-jwt-authenticator-local-only-commit-residue-20260716_20260716090426`
- Reviewed follow-up source: `ops/repair-unpublished-change-residual-lineage-20260716`
- Time sampled: `2026-07-16T09:07Z`

## Result

The jwt-authenticator local-only commit residue is now **explicitly represented** by this live task and is **not implicitly owned by the project root**. I did **not** remove the residue, because fresh primary-source git evidence shows that doing so safely now depends on a newer live local-only checkpoint commit from a sibling active holder.

## Fresh live metric and contributor shape

Fresh recompute:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count --json
# {"measuredAt":1784192820570,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":6}
```

Runtime metric row still points at the same source command and has current value `12` from the last snapshot, so the direct recompute is the fresher truth for this worker decision:

```sql
SELECT id, current, updated_at FROM metrics WHERE id = 'aks-rp-e2e.process.unpublished-change-count';
-- current = 12, updated_at = 1784192682660
```

Current live contributor set in `/app/projects/aks-rp-e2e`:

```bash
cd /app/projects/aks-rp-e2e && git status --short
#  M features/egress-lockdown.yaml
# ?? features/egress-lockdown/specs/egress-lockdown-windows-baseline.json
# ?? features/egress-lockdown/tests/egress-lockdown-windows-baseline.test.ts
# ?? features/egress-lockdown/tests/egress-lockdown-windows-baseline.ts

cd /app/projects/aks-rp-e2e && git rev-list --oneline HEAD --not --remotes=origin
# c771bb339 checkpoint: land net-integration nonlive-pair model writeback slice
# 1f87dd9ad Fix forward jwt-authenticator spec-loop reconciliation
```

So the fresh `value=6` is currently explained by:

1. `4` dirty/untracked egress-lockdown files
2. `1` local-only commit `c771bb339f4c9a7963f257bb35bc02effd520bad`
3. `1` local-only commit `1f87dd9ad437eb3c7d63a73e5602f7793b9c9c58`

## Task-tree evidence: the jwt residue is now explicit, not root-implicit

Live task-tree evidence from `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`:

- root `project.children` includes `ops/checkpoint-jwt-authenticator-local-only-commit-residue-20260716`
- `active_task_ids` includes `ops/checkpoint-jwt-authenticator-local-only-commit-residue-20260716`
- the task entry itself names the exact residue and exact remote equivalent:

```json
{
  "id": "ops/checkpoint-jwt-authenticator-local-only-commit-residue-20260716",
  "state": "active",
  "goal": "Create and drive one exact live checkpoint/cleanup holder for the jwt-authenticator local-only commit-object residue `1f87dd9ad437eb3c7d63a73e5602f7793b9c9c58` that is still counted by `aks-rp-e2e.process.unpublished-change-count`, without widening into AKS product judgment."
}
```

That satisfies the representation part of the follow-up: the jwt residue is now carried by one exact live holder instead of only by project-root residue.

## Exact jwt-authenticator residue proof

The specific counted commit remains present and remains local-only:

```bash
cd /app/projects/aks-rp-e2e && git rev-list HEAD --not --remotes=origin | grep '^1f87dd9ad437eb3c7d63a73e5602f7793b9c9c58$'
# 1f87dd9ad437eb3c7d63a73e5602f7793b9c9c58
```

No origin remote ref contains that exact commit object:

```bash
cd /app/projects/aks-rp-e2e && git branch -r --contains 1f87dd9ad437eb3c7d63a73e5602f7793b9c9c58
# <no output>
```

The pushed patch-equivalent remote commit still exists:

```bash
cd /app/projects/aks-rp-e2e && git branch -r --contains eef1d13f08d70cf4e77c9462df215dd90f8c978f
# origin/aks-explorer/normalize-rp-cluster-lifecycle-update-tags-20260715
```

And `git cherry` still classifies the jwt commit as patch-equivalent to that pushed branch:

```bash
cd /app/projects/aks-rp-e2e && git cherry -v origin/aks-explorer/normalize-rp-cluster-lifecycle-update-tags-20260715 HEAD | grep '1f87dd9ad437eb3c7d63a73e5602f7793b9c9c58'
# - 1f87dd9ad437eb3c7d63a73e5602f7793b9c9c58 Fix forward jwt-authenticator spec-loop reconciliation
```

## Why I did not remove the residue

A safe cleanup of `1f87dd9...` is **currently blocked by live branch ancestry**, not by missing jwt lineage.

Fresh evidence:

```bash
cd /app/projects/aks-rp-e2e && git log --oneline -n 2 HEAD
# c771bb339 checkpoint: land net-integration nonlive-pair model writeback slice
# 1f87dd9ad Fix forward jwt-authenticator spec-loop reconciliation
```

So `1f87dd9...` is no longer the branch tip; it is the direct parent of another live local-only commit:

- `c771bb339f4c9a7963f257bb35bc02effd520bad`
- represented by live task `domain/checkpoint-net-integration-nonlive-pair-model-writeback-slice-20260716`

That sibling task is also visible in the live tree as `active` and explicitly owns the seven-file model/knowledge-map checkpoint slice.

Because of that, removing `1f87dd9...` now would require rewriting or rethreading the current local-only stack, not just dropping a harmless detached residue. That would touch another live unpublished holder outside this task's allowed scope.

This is the exact dependency:

> `1f87dd9ad437eb3c7d63a73e5602f7793b9c9c58` must remain unpublished until the sibling live local-only commit `c771bb339f4c9a7963f257bb35bc02effd520bad` is either published/cleared by `domain/checkpoint-net-integration-nonlive-pair-model-writeback-slice-20260716` or a deliberate combined branch-realignment task is authorized to preserve both active slices while rewriting local ancestry.

## Planner/reviewer proposal

No worker-side event was emitted.

Exact task-tree proposal for the reviewer/planner to judge:

1. Treat this task as the **exact live holder** for jwt local-only residue `1f87dd9...`.
2. Record the blocker/dependency above rather than forcing a risky git rewrite from this worker session.
3. If the planner wants a wait-state mutation, convert this task to a blocked wait whose resume condition is:
   - re-sample `git rev-list HEAD --not --remotes=origin`
   - confirm whether `c771bb339...` is gone/published or a combined realignment task exists
   - then retry targeted cleanup of `1f87dd9...`
4. If the sibling model checkpoint clears first and `1f87dd9...` is still the only remaining local-only commit, dispatch a fresh bounded cleanup task for just that single commit object.

## Acceptance mapping

- **Fresh metric + task-tree evidence**: satisfied. Fresh recompute is `6`, and the task tree now explicitly carries `ops/checkpoint-jwt-authenticator-local-only-commit-residue-20260716` as an active root child.
- **Either remove or record exact blocker**: satisfied via exact blocker on sibling local-only commit `c771bb339...` and its live holder `domain/checkpoint-net-integration-nonlive-pair-model-writeback-slice-20260716`.
- **Name exact local-only + remote patch-equivalent commits**: satisfied for `1f87dd9ad437eb3c7d63a73e5602f7793b9c9c58` and `eef1d13f08d70cf4e77c9462df215dd90f8c978f`.
