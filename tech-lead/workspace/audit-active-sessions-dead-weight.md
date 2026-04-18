# Audit: Active Sessions Directory Dead Weight

**Date**: 2026-04-11  
**Lens**: C (Dead Weight) → A (Re-wire archiveSession)
**Status**: ✅ Fix implemented and deployed  
**Follow-up**: 2026-04-12 13:55 — Running binary (PID 65829, started Apr 9) predates the fix. Code is correct on main but the compiled binary hasn't been rebuilt. Sessions continue accumulating in active dir until next restart.

## Second Cleanup (2026-04-12 13:55)

| Metric | Value |
|--------|-------|
| Archived this pass | 348 |
| Failed (EACCES, nobody-owned) | 63 |
| Skipped (truly active) | 8 |
| Remaining in active dir | 71 (7 running + 63 nobody-owned + 1 edge case) |

**Root cause of continued accumulation**: The running process `/usr/local/bin/may-agent` (PID 65829) was started on Apr 9, before the archiveSession fix was merged on Apr 12. The source code has the fix but the binary hasn't been recompiled. Until the process is restarted with the new binary, stale sessions will keep accumulating.

## Summary

**99.6% of sessions in `.state/sessions/` were stale** — completed but never archived. The `archiveSession()` function existed but was deliberately removed from the completion pipeline. This caused 562MB of dead weight and forced `loadAllSessionMetas()` to scan 2,775+ extra directories on every call.

## Fix Applied (2026-04-12)

### Code change: re-wire archiveSession() into cleanupSession()

**Branch**: `review/s_1775960646669_1786`  
**Commit**: `16b9dae`

Added `archiveSession()` call back into `cleanupSession()` in manager.ts, wrapped in try/catch (best-effort). Sessions now move from `sessions/<id>/` to `sessions/history/<id>/` on completion.

Files changed:
- `src/lib/manager.ts` — added `archiveSession` import + call in `cleanupSession()`
- `test/send-persistence.test.ts` — updated assertions to check history dir
- `test/session-jsonl.test.ts` — updated assertions to check history dir

**Verification**: tsc clean, 130/130 test files pass (1959 tests), 0 new failures.

### One-time cleanup results

| Metric | Before | After |
|--------|--------|-------|
| Sessions in active dir | 2,884 | 72 |
| Successfully archived | — | 2,812 |
| EACCES (nobody:nogroup owner) | — | 63 |
| Skipped (still active) | — | 9 |

63 sessions owned by `nobody:nogroup` couldn't be renamed (different container user). These need manual cleanup with elevated permissions or will be cleaned up on container rebuild.

### Merge to main (2026-04-12 02:55)

Branch `review/s_1775960646669_1786` merged to main. Post-merge verification:
- tsc clean ✅
- 15/15 tests pass (send-persistence + session-jsonl) ✅
- Second cleanup pass: archived 27 more stale sessions
- Final state: 67 remaining in active dir (4 active + 63 nobody-owned EACCES), 20,061 in history

## Original Analysis

### Numbers (pre-fix)

| Metric | Value |
|--------|-------|
| Total sessions in `.state/sessions/` (excl. history) | 2,775 |
| Actually running/idle | 10 (0.4%) |
| Stale (done/error/interrupted) | 2,765 (99.6%) |
| Disk space: stale sessions | 562 MB |
| Disk space: active sessions | 18 MB |
| Sessions in `history/` | 17,222 |
| Disk space: history | 3.0 GB |
| Total sessions dir | 3.7 GB |

### Root Cause

`archiveSession()` was deliberately removed from the completion pipeline. The commit changed the method comment from:
```
/** Archive a session after completion: move to history and clean up step counter. */
```
to:
```
/** Clean up step counter on session completion. Sessions stay in sessions/<id>/ — no archiving. */
```

The `archiveSession()` call was explicitly removed, but all history directory infrastructure was left in place (`historyDir()`, `archiveSession()`, `archivedSessionMetaPath()`, `readSessionMeta()` fallback to history). This created the worst of both worlds: sessions accumulate in both locations.

### Safety assessment for re-wiring

1. `cleanupSession()` is called in 3 places — all immediately followed by `activeSessions.delete()`
2. `readSessionMeta()` already falls back to history dir — late reads unaffected
3. `renameSync()` is atomic on same filesystem
4. `cleanupSession` is never called for idle sessions (chat sessions return before reaching it)
5. try/catch ensures any rename failure is non-fatal

### Future work (Option C from original analysis)

Replace `loadAllSessionMetas()` file scanning with DB queries. The function still scans ~20K files (1.7s/call). Since `may.db` already has session metadata, this could be a pure DB query. That's a separate project — 8+ call sites to update.

[SIG: 1775960650:dacb89b7]
