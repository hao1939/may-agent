# Fix: Active Sessions Archival Re-wired

**Date**: 2026-04-12
**Session**: s_1775962449525_1804
**Status**: ✅ Complete — merged to main

## What Changed

`archiveSession()` was re-wired back into `cleanupSession()` in `src/lib/manager.ts`. When a session reaches a terminal state (completed/error/interrupted), it's now moved from `sessions/<id>/` to `sessions/history/<id>/` via `renameSync()`.

### Code Change (commit 16b9dae, now on main)

**src/lib/manager.ts**:
- Added `archiveSession` to imports from `./persistence.js`
- Added `archiveSession()` call in `cleanupSession()` after `cleanupStepCounter()`, wrapped in try/catch

**test/send-persistence.test.ts** + **test/session-jsonl.test.ts**:
- Updated assertions to check `sessions/history/<id>/` instead of `sessions/<id>/`

## Verification

- `tsc --noEmit`: clean ✅
- `bun test test/send-persistence.test.ts test/session-jsonl.test.ts`: 15/15 pass ✅
- Full test suite: only pre-existing gym billing.test.js failure (unrelated)

## Cleanup Results

| Phase | Archived | Failed (EACCES) | Skipped (active) |
|-------|----------|------------------|-------------------|
| First pass (previous session) | 2,812 | 63 | 9 |
| Second pass (this session) | 27 | 63 | 4 |
| **Final state** | **20,061 in history** | **63 stuck** | **4 running** |

63 sessions owned by `nobody:nogroup` can't be renamed — will be cleaned on container rebuild.

## Safety Properties

1. `readSessionMeta()` already falls back to history dir — no read breakage
2. `renameSync()` is atomic on same filesystem
3. try/catch means archive failure is non-fatal (session stays in active dir)
4. `cleanupSession` only called for terminal states (never idle/chat sessions)

## Future Work

Replace `loadAllSessionMetas()` file scanning with DB queries — still scanning ~20K files (1.7s/call).
