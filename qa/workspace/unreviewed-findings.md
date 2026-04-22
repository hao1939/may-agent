# QA Heartbeat — Unreviewed Findings

## Environment / Repo state
- `/app` is **not a git repository** (no `.git` directory found). Evidence:
  - `git log --oneline -10` failed: `fatal: not a git repository`.
  - `find .. -maxdepth 2 -name .git -type d -print` returned no results.
- TypeScript + Vitest verification cannot be executed from project root because there is **no `node_modules/.bin`** and no root `package.json`.
  - `./node_modules/.bin/tsc --noEmit` failed: `No such file or directory`.
  - `ls node_modules/.bin` failed: `No such file or directory`.
  - `find . -maxdepth 3 -name package.json` returned no results.

## What I checked
- Searched for `package.json` under `agents/` and found many under `agents/gym/scenarios/*`, suggesting those are standalone fixtures rather than an installable root workspace.
- Read one scenario file for evidence: `agents/gym/scenarios/qa-review-hard/package.json` contains only `{ "private": true, "type": "commonjs" }`.

## Impact
- QA mandatory steps (read changed file, run `tsc --noEmit`, run `vitest --run`) are **not possible** in the current environment because there is no git context to identify changes and no JS toolchain installed at the root.

## Recommendation
- Restore or mount the intended repository with `.git` metadata.
- Ensure the root includes `package.json` and `node_modules` (or provide instructions for how QA should install dependencies in this environment).
