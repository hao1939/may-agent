# Unreviewed QA Findings (heartbeat)

Date: 2026-04-26

## Context
- Recent commit inspected: `0901093` adds `.state/experiments/EXP-230-concept-lookup-deployment.md` (documentation only).

## Mandatory checks status (blocked by repo setup)
- `./node_modules/.bin/tsc --noEmit` fails because there is no `tsconfig.json` at repo root; running with `-p agents/tsconfig.json` fails with **TS18003** (no inputs) because `/app/agents/tsconfig.json` includes `src/**/*.ts`, but the repo does not appear to have `/app/agents/src`.
- `./node_modules/.bin/vitest --run` fails because `vitest` is not installed in this repo (`./node_modules/.bin/vitest` missing; `package.json` only depends on `typescript`).

## Notes
This heartbeat could not complete the mandated TypeScript and Vitest verification steps due to environment/project configuration. If this repository is intended to run TS+Vitest checks, we need:
- a root `tsconfig.json` (or correct `-p` path) with valid `include` globs for actual source locations, and
- `vitest` added to dependencies/devDependencies.
