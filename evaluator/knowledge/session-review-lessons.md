# Session review lessons (evaluator)

- Finish-guard hygiene: if workflow facts show “finish blocked by uncommitted changes”, treat as a completion failure even if the agent later claims success; require early `git status` preflight in future sessions.
- Gitignore mechanics: deliverables under `agents/shared/projects/**` may be gitignored; agents should not attempt to `git add` those paths (wasted steps + guard failures).
- Low-risk operational fix sessions can be high-value successes when the agent starts from a prior diagnosis, verifies the real consumer path before editing shared code, lands a narrow commit, and gets reviewer confirmation; brief verification-command friction does not erase the delivered value.
