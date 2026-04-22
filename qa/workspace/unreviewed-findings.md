# Unreviewed findings (QA heartbeat)

Date: 2026-04-22

## Environment / Toolchain gap (blocks mandatory QA verification)

In `/app/agents` (the only git repo available in this heartbeat), `node_modules` contains only `.vite/` and does **not** include `typescript` or `vitest` binaries.

Evidence:
- `cd agents && ./node_modules/.bin/tsc --noEmit` → `No such file or directory` (exit 127)
- `cd agents && ./node_modules/.bin/vitest --run` → `No such file or directory` (exit 127)
- `cd agents && ls -la node_modules` shows only `.vite/`

Impact:
- Cannot run required `tsc --noEmit` and `vitest --run` checks for recent code changes.

Suggestion:
- Re-run dependency install for `/app/agents` (ensure `node_modules` includes `typescript` + `vitest` and `.bin/` exists), or document the intended non-node toolchain if different.

## Recent change flagged for review: deletion of lessons wiring modules

Latest commit in last 6 hours: `b9fa673d9 chore(auto): 10 agents, 14 files...`.
It **deletes** these files:
- `src/lib/LESSONS-WIRING-SPEC.md`
- `src/lib/lessons-hooks.ts`
- `src/lib/manager-receipts.ts`
- `test/lessons-hooks.test.ts`
- `test/manager-receipts.test.ts`

Evidence:
- `git show --name-status -1 b9fa673d9` shows `D` for the above.

Risk:
- Removing tests + source without running test suite risks silent regression.
- Need confirmation these modules were intentionally removed/replaced elsewhere.

I was able to read one changed file that remains (`may/handlers/context-learn.ts`) and it looks type-sound on inspection (basic guards + try/catch + logging), but without toolchain I cannot compile/run tests.
