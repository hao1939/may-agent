# Finding: 24 Zombie Sessions Not Being Archived

**Date**: 2026-03-18
**Severity**: Medium (waste/clutter, not blocking)
**Status**: ✅ FIXED — commit 4c7cdc3 (archive zombie sessions on startup). Needs PID 7 restart to activate.

## Problem

24 session directories remain in `.state/sessions/` (active dir) despite being terminated 18+ hours ago. They have `status: "interrupted"` in meta.json but were never moved to `sessions/history/`.

## Root Cause

When the May process restarts, it reads session directories from disk. Sessions that were `autoClose: "never"` (persistent/chat sessions) and were interrupted by the process shutdown are left in the active directory. The in-memory `activeSessions` Map doesn't include them (they're loaded from disk meta.json, not the Map), so `archiveSessionDir()` is never called for them.

The watchdog handler (`watchdog.ts`) explicitly skips `autoClose: "never"` sessions, so it can't clean these up either.

## Evidence

- 22 of 24 zombie sessions: `autoClose: "never"`, `status: "interrupted"`
- 2 others: `autoClose: "immediate"` or unreadable meta
- All are from before 2026-03-17T06:00 UTC (18+ hours old)
- Agents affected: mostly May (16), plus Bob (3), tech-lead (1), scout-c40 (1), unknown (2)

## Impact

- **Disk clutter**: 24 dirs that should be in history/
- **Potential confusion**: any code that scans `sessions/` for active sessions will see these
- **`persistence.ts:listSessionIds()`** returns these as "active" session IDs

## Fix Options

1. **Startup cleanup (recommended)**: In `manager.ts` startup, scan all session dirs. Any session with `status: "interrupted"` or `status: "done"` or `status: "error"` in meta.json → call `archiveSession()` immediately. ~10 lines of code.

2. **Watchdog enhancement**: Make watchdog also check for non-running sessions in the active dir (status != "running" && status != "idle") and archive them.

3. **One-time manual fix**: `mv .state/sessions/s_17732* .state/sessions/s_17733* .state/sessions/s_17734* .state/sessions/s_17735* .state/sessions/s_17736* .state/sessions/history/`

Option 1 is the proper fix. Option 3 is an immediate workaround.
