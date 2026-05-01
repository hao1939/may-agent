# Vitest Gym Exclusion Fix

## Problem
Running `npx vitest run` from `/app` root discovers 202 gym scenario test files that intentionally fail (they use fake packages agents must fix). This pollutes test output with false failures.

## Finding
- `/app/agents/vitest.config.ts` limits `include` to `test/**/*.test.ts` — gym scenarios don't match
- Running from `/app/agents` directory: **31 files, 536 tests, 0 failures** ✅
- Running from `/app` root: **937 files, 202 failed files** (gym scenarios) — no root vitest config
- Cannot write `/app/vitest.config.ts` (permission denied)

## Fix Applied
Added explicit `exclude` to `/app/agents/vitest.config.ts` as defense-in-depth:
```
exclude: ["gym/**", "node_modules/**", "shared/projects/outputs/**"]
```

## Recommendation
All tooling (regression-guard.sh, CI) should run vitest from `/app/agents`, not `/app` root:
```bash
cd /app/agents && npx vitest run
```

## Current Test Health
- **536 tests, 0 failures** (from `/app/agents`)
- **8656 passing, 1 failed** (from `/app` root — the 1 failure + 202 file failures are all gym scenarios)
