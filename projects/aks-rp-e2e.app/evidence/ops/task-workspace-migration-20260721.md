# Task workspace migration — 2026-07-21

AKS was paused through `setProjectLifecycle` before mutation. `origin/dev` was
fetched and remained at `c7db615eab90d868a567ff5d8702cb87a580e974` through
the migration.

## Before

- 577 registered worktrees after the final pre-cleanup refresh
- 562 present and 15 stale registrations
- 96 dirty when both tracked and untracked files were counted
- no active structured task-worktree attempt
- canonical root on
  `aks-explorer/queue-rp-operation-status-polling-managed-cluster-lineage-20260720`
  at `a82aca2dee9c6d521fa29533826c868d282028e4`
- canonical divergence from `origin/dev`: 140 base-only and 19 root-only
- canonical status: 198 tracked/untracked entries after legacy worktrees were
  moved out

## Mechanical cleanup

The cleanup revalidated project pause, base commit, each candidate HEAD, full
dirty status, and active attempt ownership immediately before removal.

- 466 clean non-canonical worktrees removed
- 0 cleanup gate failures
- 15 stale registrations pruned
- attached local branches retained
- one clean detached unpublished head preserved as a
  `migration/rescue-*` branch before removal

The retained cleanup receipt is
`task-workspace-migration-cleanup-20260721.json`.

## Dirty recovery organization

All 95 dirty non-canonical worktrees were moved, deepest first, beneath:

```text
/app/worktrees/aks-rp-e2e/recovery/
```

Every move revalidated HEAD and dirt first. No worktree failed relocation. The
old/new mapping is retained in
`task-workspace-dirty-relocation-20260721.json`.

The dirty canonical root was moved without manufacturing a mixed commit:

1. its tracked and untracked changes were captured in a temporary stash;
2. the root switched to and fast-forwarded `dev`;
3. the old task branch received a dedicated quarantine worktree;
4. the stash was applied and its 198-entry status read back exactly;
5. the 560 MB ignored historical scratch `workspace/` moved beside it; and
6. the temporary stash was dropped only after readback succeeded.

The result is retained in
`task-workspace-canonical-restoration-20260721.json`.

## After

- `/app/projects/aks-rp-e2e` is clean `dev` exactly at `origin/dev`
- 97 registered worktrees: one clean canonical checkout and 96 visible dirty
  recovery/quarantine worktrees
- no prunable registrations
- no active attempt-linked worktree
- no unpublished work was discarded

The current row-by-row status is
`task-workspace-migration-inventory-20260721.json`. The 96 recovery worktrees
are not execution capacity. Their contents require bounded owner review before
individual extraction or removal.
