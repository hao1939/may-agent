# QA Heartbeat — Unreviewed Findings (2026-04-22)

## Context
While checking for unverified changes in the last ~6 hours, the `/app` root is not a git repo, but `/app/agents` is.

## Unreviewed changes spotted
- Commit: `62443c24a` — `pwi-evaluator-tuning MS3+MS4: simplified evaluator rubric + 2-attempt auto-advance`
  - Changed file of interest: `agents/shared/workflows/project.ts`

## Evidence read (file)
- `agents/shared/workflows/project.ts` lines 1–200 were read.
  - Notable behavior: `parseInput()` infers project format (directory vs legacy `.md`), and may read the goal from `project.md` via `extractSection(content, "Goal")`.

## Build/Test health (environment)
### TypeScript
- `./node_modules/.bin/tsc --noEmit` from `/app` **FAILED**: `No such file or directory` (node_modules missing at /app).
- `npx tsc --noEmit` from `/app/agents` **FAILED**: TypeScript is not installed in that workspace.

### Vitest
- `npx vitest --run` from `/app/agents` **FAILED** very broadly (output truncated): 100 failed test files / 12 passed.
  - Many failures are expected given this repo contains intentionally failing gym scenario test files (e.g., `process.exit unexpectedly called` / `No test suite found`).

## QA notes
- The mandatory QA commands (`./node_modules/.bin/tsc --noEmit` and `./node_modules/.bin/vitest --run`) cannot be executed as-specified due to the environment lacking local `node_modules` in `/app`.
- Repo-wide `vitest --run` is currently not a meaningful signal because it runs the gym scenario fixtures that intentionally fail.

## Recommended follow-ups
1. Define the canonical workspace for QA verification: `/app` vs `/app/agents`.
2. Ensure local dev dependencies exist in that workspace (TypeScript + Vitest binaries) or provide a supported invocation.
3. Adjust vitest config to exclude `gym/scenarios/**/environment/**` from the default test run, or provide a separate test target for fixtures.
