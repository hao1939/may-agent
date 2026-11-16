---
name: bounded-cleanup
description: Prune or archive items proven obsolete or superseded while preserving active, paused, or owned work.
---

# Bounded Cleanup

Use this skill when Hao asks for cleanup, removal, deletion, pruning, or archival
triage and local project evidence can distinguish clearly superseded work from
paused, active, unreplaced, or otherwise still-owned work.

## Required decision

1. **Read the state boundary.** Identify which item is proved obsolete, unused,
   stale, legacy, or fully superseded, and which nearby items are paused,
   active, unreplaced, waiting, or still owned.
2. **Act on the one safe cleanup.** When exactly one bounded item is fully
   superseded and the repository already preserves recovery, remove only that
   item. Do not ask Hao a clarification question whose answer is already implied
   by the evidence.
3. **Do not broaden the deletion.** Explicitly preserve paused, active,
   unreplaced, waiting, or ambiguous items. If evidence cannot distinguish two
   plausible deletion scopes, stop and ask for the missing strategic choice.
4. **Use removal, not archival copies.** Do not create a parallel archive or
   backup copy inside the workspace for Git-committed material. Treat Git
   history as the recovery path unless the task names an external retention
   requirement.
5. **Block cleanup on non-empty `git diff` or uncopied findings.** If a scoped
   `git diff` is non-empty or contains uncopied findings, block cleanup
   (`state: "converged"`, no `requests`) and preserve the worktree until those
   changes are reconciled.
6. **Require durable closure before worktree deletion.** Never delete a review
   or incident worktree before its final closure/disposition is durably
   submitted through the real submission path. If no durable closure submission
   path is exposed, block deletion (`state: "converged"`, no `requests`),
   write `"block worktree cleanup until durable closure is submitted"` in
   `summary`, and state in `response` that you block cleanup because durable
   closure must be submitted **before deleting** the worktree, the real
   submission path is **not exposed**, and **ask** for the submission path or
   owner help.
7. **Report the boundary.** State the removal and the preserved items directly,
   with the evidence and recovery path.

## `TaskReconcileResult` mapping

When returning `TaskReconcileResult` through `finish()`:
- `summary`: state the exact cleanup action (e.g., `"remove only legacy-alerts and rely on Git history for recovery"` or `"block worktree cleanup until durable closure is submitted"`).
- `facts`: list the key evidence and constraints (`"Git history is recovery"`, `"remove only the proved superseded item"`, `"preserve paused and active work"`, `"no archival copy"`).
- `response` (when `state: "converged"`) or `communication[0].message` (when `state: "waiting"`): tell Hao what will be removed or blocked now, what will be preserved, and that Git history provides rollback/recovery.
