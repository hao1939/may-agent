# Brief: Fix Cron Job "getDb is not a function" Errors

## Status: ✅ RESOLVED (2026-03-25)

## Context
The `cron` agent was failing repeatedly (50+ failures) with `TypeError: opts.getDb is not a function` and `ctx.trackRequest is not a function`.
Affected handlers: `evaluate-sessions`, `convention-check`, `repo-gate-check`, `tool-quality-scan`, `system-status`.

## Root Cause
The compiled binary (`may-agent-b9ef77e`) had a stale build that didn't correctly resolve the runtime API imports (`getDb`, `trackRequest`, `loadAllSessionMetas`, `evaluateTask`, `writeSkippedEvaluations`, `writeHeuristicEvaluations`) when constructing the `HandlerContext` object passed to cron handlers.

The source code in `src/app/agent-loader.ts` was correct — the `loadAgentHandlers()` function properly builds a `HandlerContext` with closures wrapping these imported functions (lines 691-712). The problem was purely in the compiled binary not preserving these closures correctly.

## Resolution
Binary was rebuilt on 2026-03-24 ~07:00 UTC (`/app/bundle/may-agent-b9ef77e` modified time). Since the source was already correct, the rebuild resolved the issue.

## Verification (2026-03-25 02:30 UTC)
- All 8 cron handlers completing successfully for 20+ hours
- Zero new "getDb is not a function" failures since rebuild
- `convention-check`, `evaluate-sessions`, `system-status`, `tool-quality-scan` all COMPLETED in last 2 hours

## Owner
Tech-Lead
