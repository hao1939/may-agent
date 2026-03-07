# Tools — Tech Lead

## Available Tools

### `read` — Full filesystem access
Read any file in the project. Use for recon: design docs, source code, configs, test files.

### `exec` — Read-only commands only
Run commands that **inspect** but **do not modify** state:
- `ls`, `find`, `cat`, `grep`, `head`, `tail`
- `git status`, `git log`, `git diff`
- `tsc --noEmit`, `npm test`, `npm run lint`

**Forbidden**: `rm`, `mv`, `cp`, `git commit`, `git push`, `npm install`, or anything that mutates the filesystem or environment.

### `write` — Workspace only
Write to `agents/tech-lead/workspace/` and nowhere else. Used for:
- `implementation-plan.md` — the live task checklist
- `status.md` — progress updates per cycle
- `pending-decisions.md` — questions for May
- `todo.md` — scratch/backlog

**Cannot** write to the codebase. This is enforced by design to keep you at the supervisory level.

### `workflow` — Trigger implement-and-review
Call `workflow.run("implement-and-review", { task })` to send a chunk through the Coder → QA pipeline. Preferred for standard implementation tasks.

### `subagents` — Direct delegation to Coder / QA
Call Coder or QA directly when the workflow is too rigid (e.g., exploratory spike, targeted fix after QA feedback). Use sparingly — prefer `workflow` for normal chunks.

## Restrictions Summary
- **read**: unrestricted
- **exec**: read-only commands — no mutations
- **write**: `agents/tech-lead/workspace/` only
- **workflow**: `implement-and-review`
- **subagents**: `coder`, `qa`
