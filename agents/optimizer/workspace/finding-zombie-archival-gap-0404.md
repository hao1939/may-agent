# Finding: Zombie Session Archival Gap

**Date**: 2026-04-04 16:20
**Severity**: Medium
**Impact**: 109 zombie session dirs (42.6 MB) accumulating in active sessions directory

## Problem

`cleanupZombieSessions()` in `src/lib/manager.ts` had three phases:
1. **Phase 1**: Mark stale `running` sessions as `interrupted` (works correctly)
2. **Phase 2** (old): Fix DB-only mismatches (works correctly)

**Missing**: No phase to **archive terminal sessions** (done/error/interrupted) that are still sitting in the active sessions directory (`sessions/<id>/`). Normal archival happens in `cleanupSession()` which calls `archiveSession()` — but if that fails (process crash, race condition), the directory stays in the active dir forever.

The comment in `cleanupSession()` says "zombie cleanup will catch it later" but zombie cleanup never did — it only handled the `running` → `interrupted` transition, never archival.

## Evidence

- 111 dirs in `.state/sessions/` (excluding history/)
- 109 are terminal (61 done, 31 error, 17 interrupted) — only 2 actually running
- 42.6 MB total disk usage from zombies
- 97 of 109 have `maxTurns: undefined` — from before the maxTurns fix
- 16,864 sessions properly in history/

## Fix

Added **Phase 2** (renumbered old Phase 2 to Phase 3): iterate all active session dirs, skip those in `activeSessions` map, check meta status — if terminal, call `archiveSession()` to move to `history/`.

**File**: `src/lib/manager.ts`, `cleanupZombieSessions()` method

## Expected Impact

- 109 zombie sessions cleaned up on next handler run (~42.6 MB freed)
- Prevents future accumulation
- No functional change — these sessions are already complete, just in the wrong directory

## Verification

- `bun x tsc --noEmit` — compiles clean
- `bun test` — all tests pass (25+ tests)
