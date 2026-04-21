# Unreviewed findings (qa heartbeat)

## Context
- `/app` is **not** a git repo; only `/app/agents` is.
- The mandatory repo-level checks **cannot be executed** because there is no Node project at `/app` (no `node_modules/.bin/tsc` or `node_modules/.bin/vitest`).

## What I checked
- `git log` and `git status` in `/app/agents`.
- Read `agents/qa/workspace/heartbeat-context.md`.

## Findings
### IMPORTANT — Cannot run required QA checks
- `./node_modules/.bin/tsc --noEmit` fails: `No such file or directory`.
- `./node_modules/.bin/vitest --run` fails: `No such file or directory`.

This appears to be an environment/repo layout issue: `/app` contains only `.state/` and `agents/`. There is no TypeScript/Vitest project to validate.

### MINOR — Workspace files modified across agents
`git status` shows multiple modified `*/workspace/heartbeat-context.md` files. These are likely auto-generated heartbeat artifacts and probably should not be committed unless intentionally tracked.

## Next steps
1. Clarify which repository/package is the intended target for TS/Vitest checks.
2. If checks are meant for `/app/agents`, add or document the correct commands (or a package path) to run TypeScript/tests.
3. Decide whether `agents/**/workspace/heartbeat-context.md` should be gitignored.
