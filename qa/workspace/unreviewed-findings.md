# Unreviewed Findings (QA Heartbeat)

Date: 2026-04-28

## Notes
- Recent commits (last 10) are dominated by `amy` tiered-tax work; latest commits only touched `amy/last-session.md` and `gym/scenarios/compound-edit-verification/context.md`.

## Findings
1) **Tooling mismatch:** `./node_modules/.bin/vitest` is missing in `/app/agents`, so the mandated command fails (`No such file or directory`). However, `npx vitest --run` works and all tests pass.
   - Evidence: `ls node_modules/.bin | grep vitest` shows none; `npx vitest --run` reports 117 tests passed.

2) **Documentation-only change in gym scenario:** `gym/scenarios/compound-edit-verification/context.md` currently contains only the "Verify-After-Edit Procedure" block; unclear if the rest of the scenario context was intentionally removed or if this file is meant to be minimal.
