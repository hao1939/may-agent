# QA Heartbeat — Unreviewed Findings (2026-04-22)

## Context
This environment is **not a git repository** (no `.git` found), so I cannot determine what changed in the last 6 hours via `git log`/`git diff`.

Additionally, expected Node toolchain binaries are missing:
- `./node_modules/.bin/tsc --noEmit` → not found
- `./node_modules/.bin/vitest --run` → not found

These prevent the mandatory QA verification steps for TypeScript and tests.

## What I verified anyway
- Read and sanity-checked key runtime files:
  - `src/pipeline.js` (grading workflow orchestration)
  - `src/penalties.js` (late penalty logic)
- Basic runtime execution:
  - `node -e "const {run}=require('./src/pipeline'); console.log(run());"` successfully produced a report object.

## Potential issues spotted
- **IMPORTANT:** Tooling gap: no `node_modules` in repo/environment, so static typecheck/tests can’t be executed. If this is intended, QA process needs an alternate verification path; if not intended, CI/dev setup is broken.
- **MINOR:** In `src/penalties.js`, despite the file comment stating penalties are applied to the `PERCENTAGE score`, the calculation uses `rawPct` derived from `record.score/record.max_score` rather than `record.pct`. If `normalize()` mutates `score`/`max_score` or `pct` differently, this could drift. (Needs domain clarification.)
