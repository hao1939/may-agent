# Unreviewed findings (QA heartbeat)

## Environment / repo status
- Project root `/app` is **not** a git repository. Git history exists under `/app/agents` only. (evidence: `find .. -maxdepth 3 -name .git` shows `../app/agents/.git`)

## Recent change spotted
- Latest commit in `/app/agents`: `4120d9b5a coach: heartbeat - EXP-201 skill activation experiment designed`.
  - Only file changed: `agents/coach/last-session.md` (evidence: `git show --name-only --oneline -1`).

## Verification blockers (CRITICAL for strict QA gate)
- Cannot run mandatory `./node_modules/.bin/tsc --noEmit` at repo root because `node_modules` does not exist in `/app` (evidence: `/bin/bash: ./node_modules/.bin/tsc: No such file or directory`).
- Attempting to run TypeScript in `/app/agents` also fails because `typescript` is **not installed** in that workspace despite being listed in `devDependencies`.
  - `npm ls typescript` returns `(empty)`.
  - `node_modules/typescript` not found.
  - `npx tsc --noEmit` errors: "This is not the tsc command you are looking for".
- Cannot run mandatory `./node_modules/.bin/vitest --run` in `/app/agents`: binary missing; `vitest` not installed. (evidence: `./node_modules/.bin/vitest: No such file or directory`)

## File content check
- Read `agents/coach/last-session.md` (first 200 lines). It appears incomplete (ends at: "Now let me verify the commit:") — likely truncated content or unfinished generation.

## Suggested follow-ups
1. Ensure the correct working directory for QA checks (root vs `agents/`).
2. If `/app/agents` is the intended TS project, install dev deps (`npm ci`) so `tsc` is available.
3. Clarify whether vitest is expected in this repo; if so, add it to `devDependencies` and ensure tests exist.
