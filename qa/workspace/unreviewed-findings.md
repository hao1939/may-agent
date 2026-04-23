# Unreviewed findings (QA heartbeat)

## Context
- Repo root for code is `/app/agents` (git repo).
- Unable to run mandatory checks because dev dependencies are missing in this environment (no `typescript`, no `vitest`).

## Evidence
- `./node_modules/.bin/tsc --noEmit` fails: `No such file or directory`.
- `npx --no-install tsc --noEmit` fails with: "This is not the tsc command you are looking for" (TypeScript not installed).
- `./node_modules/.bin/vitest --run` fails: `No such file or directory`.
- `package.json` only lists `puppeteer-core` under dependencies.

## Code spot-check (recent change)
Commit `de24b0f41` modifies:
- `agents/shared/workflows/project.ts`
- `agents/may/handlers/project.ts`

I read both files (first ~260 lines each). No immediate red flags in those sections, but the workflow file read was truncated; full verification requires reading the relevant changed regions and running typecheck/tests.

## Risk
Without `tsc` and `vitest`, QA cannot confirm the recent project workflow fixes compile or pass tests.

## Recommendation
- Add `typescript` and `vitest` (and any required config) as devDependencies in `/app/agents/package.json`, or provide a documented alternative verification command in this repo.
- Once available, rerun:
  - `./node_modules/.bin/tsc --noEmit`
  - `./node_modules/.bin/vitest --run`
