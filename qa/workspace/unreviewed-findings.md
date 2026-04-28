# QA Heartbeat — Unreviewed Findings (2026-04-28)

## Context
Heartbeat review triggered by notifications about duplicate "Quick Code Review" requests and a request to verify gym scenario EXP-220.

## Findings

### 1) TypeScript build currently fails in `agents/` (CRITICAL)
- Command: `cd agents && ./node_modules/.bin/tsc --noEmit`
- Result: FAIL
- Error:
  - `shared/lib/project-health.ts(219,7): error TS2741: Property 'comment' is missing in type '{ type: "launch-workflow"; reason: string; }' but required in type 'HealthAction'.`

Evidence: In `agents/shared/lib/project-health.ts` the `diagnoseProject()` function returns `{ type: "launch-workflow", reason: "closed but has unread comments — reopening" }` when project status is `closed` and unread comments exist. This return object omits `comment`, but other returns include it.

### 2) Test runner missing in `agents/` install (ENVIRONMENT)
- Command: `cd agents && ./node_modules/.bin/vitest --run`
- Result: FAIL
- Error: `/bin/bash: line 1: ./node_modules/.bin/vitest: No such file or directory`

This appears to be an environment/deps issue (vitest not installed in `agents/node_modules`). It blocks independent verification of tests.

### 3) Gym scenario EXP-220 not found by name (IMPORTANT / SPEC UNCLEAR)
Notification asked to verify scenario `EXP-220 (enoent-file-search)` exists. In `agents/gym/scenarios/` there is no `enoent-file-search` or `exp-220` directory in the tail listing I checked.

This may be a naming mismatch (scenario might exist under a different folder name) or the scenario hasn't been added.

## Suggested Next Actions
1. Fix `HealthAction` return type mismatch in `agents/shared/lib/project-health.ts` by including required `comment` field (or making it optional) and rerun `tsc`.
2. Restore/ensure `vitest` is installed and accessible under `agents/node_modules/.bin/vitest` (or update instructions to use workspace root).
3. Locate or add the EXP-220 scenario; clarify expected path/name in the notification.
