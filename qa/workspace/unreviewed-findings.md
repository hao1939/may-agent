# QA Heartbeat — Unreviewed Findings (2026-04-30)

## Environment / Tooling Issues

### 1) `vitest --run` succeeds but process exits non-zero due to permissions (EACCES)
- **Evidence:** Running `cd agents && ./node_modules/.bin/vitest --run` shows **536 tests passed**, then crashes trying to write cache: `EACCES: permission denied, open '/app/agents/node_modules/.vite/vitest/results.json'`.
- **Impact:** CI/local runs may fail despite passing tests; blocks automation.
- **Likely cause:** `node_modules/.vite` not writable for current user in this container.

### 2) `tsc --noEmit` fails due to duplicate re-exports in shared barrel
- **Evidence:** `cd agents && ./node_modules/.bin/tsc --noEmit` fails with `TS2308` duplicate exports for `IterationRecord` and `ValidationResult` originating from `shared/lib/index.ts` re-exporting `iteration-monitor.js` and `task-validator.js` (and/or their transitive exports).
- **Impact:** Typecheck is red even though tests pass.

## Recent Change Needing Review

### Commit `eebece593` — `shared/workflows/project.ts`
- **Change summary (from git show --name-only):** “add [continue] comment fast-path in project.ts”.
- **Manual spot-check:** Read top of `shared/workflows/project.ts` (lines 1-200) and confirmed input parsing includes special-casing goal extraction when goal is generic (`see project file` / `continue the project`).
- **Remaining review:** Need to inspect the specific “[continue] comment fast-path” logic further down in the file (not yet read; file is large).
