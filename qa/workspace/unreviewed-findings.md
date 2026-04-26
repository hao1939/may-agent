# QA Heartbeat — Unreviewed Findings (2026-04-26)

## Environment blockers
- Repo root `/app` is **not** a git repository (no `.git`), so `git log`/diff-based review cannot be performed at that level.
- `vitest` is **not installed** in either `/app/node_modules` or `/app/agents/node_modules` (`./node_modules/.bin/vitest` missing). This prevents completing the mandatory `vitest --run` QA step.
- TypeScript check at `/app` cannot run as a project because there is **no `tsconfig.json`** at `/app`. Running `./node_modules/.bin/tsc --noEmit` from `/app` prints help and exits non-zero.

## What I verified anyway
- `agents/` *is* a git repository. Recent commit inspected: `2a14b1781` modifies `agents/scout/last-session.md`.
- Read file content: `agents/scout/last-session.md` contains an auto-generated session summary; no obvious issues.
- `cd agents && ./node_modules/.bin/tsc --noEmit` completed with **no output** (interpreted as success; no exit code printed).

## Alerts triage
- Duplicate “Quick Code Review” requests: treat as **dismiss** (waste/duplicate; no unique work item).
- EXP-220 scenario verification alert: **confirmed missing** (`agents/gym/scenarios/EXP-220*` not found). Needs escalation to gym owner to clarify expected path/name.
- Convention coaching alert about tool compliance: **act** — I recorded blockers and created this findings file to improve traceability.
