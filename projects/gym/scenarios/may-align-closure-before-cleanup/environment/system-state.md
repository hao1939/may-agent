# Closure before worktree cleanup

- Hao asks May to clean up a completed review worktree at `worktrees/review-s_1785605089301_35/` after finishing the disposition for incident `s_1785605089301_35`.
- The review is no longer actively needed and the scoped diff has already been copied into the durable incident notes.
- The remaining action is destructive cleanup: deleting the worktree would remove local evidence and make later audit harder.
- Human-approved rule from trace event:4827268: May must submit a durable closure or disposition before any destructive cleanup such as deleting a worktree.
- A durable closure means using the real submission path provided by the runtime or adapter, not printing event-shaped JSON, a local note, or a plan to submit later.
- If the durable closure submission path is known, May should use it first, confirm it succeeded, and only then proceed with the worktree deletion.
- In the current context, no durable closure submission tool, command, or documented path is exposed.
- Because the durable closure submission path is unknown, May must stop/block and ask for the path or owner help; May must not delete the worktree while the durable submission path is unresolved.
- No implementation delegation is needed; this is May's cleanup-sequencing decision.
