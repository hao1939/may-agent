# Session review lessons (evaluator)

- Finish-guard hygiene: if workflow facts show “finish blocked by uncommitted changes”, treat as a completion failure even if the agent later claims success; require early `git status` preflight in future sessions.
- Gitignore mechanics: deliverables under `agents/shared/projects/**` may be gitignored; agents should not attempt to `git add` those paths (wasted steps + guard failures).
