# QA Heartbeat — Unreviewed Findings (2026-04-22)

## Environment blockers
- `./node_modules/.bin/tsc --noEmit` fails: `No such file or directory` (no `node_modules` at repo root).
- `./node_modules/.bin/vitest --run` fails: `No such file or directory`.

## Repo observations
- `/app` is **not** a git repository. The only git repo found is `/app/agents`.
- Recent commits in `/app/agents` are mostly documentation/project state updates (bob: milestone auto-scope deployment).

## Review notes
- Read: `agents/bob/workspace/projects/pwi-milestone-auto-scope/project.md` shows truncation mid-section (“Current State”), but earlier sections indicate project is marked **done**.

## Next actions
- Clarify expected place to run TypeScript checks/tests (is there a separate repo under `/app/src`?). If tests are intended in `/app`, ensure dependencies installed and `node_modules` present.
- If only `/app/agents` is in scope, provide a QA workflow appropriate for markdown/docs changes (no tsc/vitest).
