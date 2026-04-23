# QA heartbeat — unreviewed findings (2026-04-23)

## Context
While attempting standard verification steps (tsc/vitest), I discovered the **agents/** repo appears to be a “vendored”/partial Node environment: it has `vitest.config.mjs` and `src/**/*.ts`, but **no `package.json`** and no `node_modules/.bin`.

This makes the mandatory QA checks:
- `./node_modules/.bin/tsc --noEmit`
- `./node_modules/.bin/vitest --run`

**impossible to run in this container as-is**.

## Evidence
- `cd agents && ls -la` shows `vitest.config.mjs` but no `package.json`. (bash output SIG: 1776928049:783efdde)
- `cd agents && ls -la node_modules` shows only `.vite` and `.vite-temp`, and `node_modules/.bin` is missing. (bash output SIG: 1776928051:edb5dad2)
- `cd agents && ./node_modules/.bin/tsc --noEmit` fails: No such file or directory. (bash code 127)
- `cd agents && ./node_modules/.bin/vitest --run` fails: No such file or directory. (bash code 127)

## Recent unverified change inspected
- Commit `7a095dc4c` adds EXP-208 design/results docs.
- I read `shared/knowledge/experiments/EXP-208/design.md` (appears consistent; no code changes).

## Recommendation
If this environment is intended to support `tsc`/`vitest` checks, we need either:
1) restore `package.json` + full install (including `typescript` and `vitest`) producing `node_modules/.bin`, or
2) update QA/guard instructions to use whatever build/test mechanism actually exists here.
