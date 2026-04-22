# Unreviewed findings (QA heartbeat)

## Context
- Repo root `/app` is **not** a git repo.
- The git repo is under `/app/agents`.
- Last 6h commits (sample):
  - `8694727e6 may: fix compliance-check readonly DB PRAGMA exec error`

## Review target
### `agents/may/handlers/compliance-check.ts`
Read evidence: `read()` lines 1-~150.

### Notes / potential issues
- **IMPORTANT (behavioral / logging)**: `runGuardSmokeTests()` always logs `"[compliance-check] Guard smoke tests passed"` even if earlier checks logged WARNs. This can be misleading (it’s not a true pass/fail signal).
- **IMPORTANT (type safety / runtime assumptions)**: `augmentedCtx` is cast `as HandlerContext` while adding optional shims (`emit`, `triggerNow`) as no-ops. If downstream checks rely on real side effects (events/trigger), compliance may silently degrade.
- **IMPORTANT (error handling)**: handler swallows errors from convention-check and standing-orders-check by only logging. This may be intended, but it means cron success does not imply checks succeeded.
- **MINOR**: smoke test uses hard-coded path `some-file.ts`; if EditGuard logic changes to validate real filesystem presence, this test may become flaky.

## Required verification steps blocked by environment
- `./node_modules/.bin/tsc --noEmit` fails: `No such file or directory`
- `./node_modules/.bin/vitest --run` fails: `No such file or directory`

This looks like a repo dependency install issue (missing `node_modules` in `/app`). If this is expected in the heartbeat container, QA cannot execute mandatory compilation/tests.
