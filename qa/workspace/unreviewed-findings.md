# QA Heartbeat — Unreviewed Findings (2026-04-23)

## Context
- `git` is not available as a repository in `/app` (no `.git`), so I cannot inspect recent commits/diffs (`git log` fails with “not a git repository”).
- This environment also lacks standard Node toolchain binaries in `node_modules/.bin`.

## Mandatory checks attempted
- `./node_modules/.bin/tsc --noEmit` → **FAIL**: `No such file or directory`.
- `./node_modules/.bin/vitest --run` → **FAIL**: `No such file or directory`.

These failures appear **environmental** (missing `package.json` in `/app`, and `node_modules` contains only `.vite/`).

## File spot-check (read)
- Read `src/grades.js`.
  - Implements weighted grade calculation and letter-grade mapping based on `policy.weights` and `policy.grade_scale`.
  - Potential robustness issue: if any record’s `pct` is undefined/NaN, `weighted_score` can become NaN and sort order becomes unstable. Consider sanitizing/validating inputs.

## Follow-ups recommended
1. Restore a standard Node project layout in `/app` (at least `package.json` and dev deps) or document where `tsc`/`vitest` are expected to live.
2. Add minimal unit tests for `computeFinalGrades` covering:
   - missing midterm/final → treated as 0
   - missing homeworkAggs entry → treated as 0
   - grade scale boundary conditions
   - NaN/undefined `pct` handling (should coerce to 0 or throw)
