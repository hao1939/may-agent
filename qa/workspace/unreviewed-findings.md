# Unreviewed findings (QA heartbeat)

## Repo status
- Running from `/app`, the top-level directory is **not** a git repo.
- The git repo appears to be `/app/agents`.

## Recent commits (last 10)
From `/app/agents`:
- 7487ee26c tech-lead: update last-session after alert flood and stuck detection fix
- f83536409 tech-lead: fix alert flood and false stuck detection in persistent-task workflow
- 54e68e20c tech-lead: update todo - mark implement-and-review archival done
- eb6341efe cleanup: archive implement-and-review.ts (0 recent usage, superseded by implement-and-verify)
- 1a2ed4e51 cleanup: archive implement-and-review workflow (0 recent usage), update may agent.json hints to reflect current workflows
- 1c8b5d540 coach: HB45 session state
- 5198b067a coach: HB45 - unblocked, QA analysis
- 88857123b coach: QA operational failures brief
- 1c1b25813 fix: breadcrumb gap - add G-pattern + trails to all heartbeat workflows, fix measurement script
- 8767c510e tech-lead: redesign project handler from dumb resume to intelligent health monitor

## Working tree changes
Uncommitted modifications exist in multiple `*/workspace/heartbeat-context.md` files and `tech-lead/last-session.md`.
These look like auto-generated heartbeat artifacts; consider excluding them from commits (or ensuring they’re intentionally tracked).

## Tooling gaps (blocks mandatory QA checks)
Mandatory steps require:
- `./node_modules/.bin/tsc --noEmit`
- `./node_modules/.bin/vitest --run`

In `/app/agents`, `node_modules/.bin` does not exist and no `package.json` was found, so those commands cannot currently be run.
Action needed: clarify where the TypeScript/Vitest project lives (maybe `/app` instead of `/app/agents`), or add/install the toolchain.

## Files spot-checked
- `agents/qa/workspace/heartbeat-context.md` contains an auto-generated active nudge + context block.
- `agents/tech-lead/last-session.md` is present and appears auto-generated.
