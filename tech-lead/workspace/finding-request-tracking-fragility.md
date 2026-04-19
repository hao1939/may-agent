# Finding: Request Tracking Fragility (Lens D)

**Date**: 2026-04-19  
**Severity**: Low-Medium  
**Status**: Documented — no fix needed yet

## Summary

The request tracking system has three fragility points: (1) `updateRequest()` silently succeeds when given a non-existent requestId, (2) fuzzy matching for `completed_items` can match the wrong request, and (3) all error handling is best-effort with silent catch blocks. In practice, these are low-risk because the system is append-heavy and concurrent writes are rare.

## Evidence

### 1. Silent no-op on missing requestId

`updateRequest()` (`src/lib/requests.ts:268`) runs `UPDATE requests SET ... WHERE requestId = ?` without checking `result.changes`. If the requestId doesn't exist, SQLite returns `changes=0` and the function returns void — no error, no log, caller unaware.

The fuzzy-match path in `createRequestTracker()` (`src/lib/session-subscribers.ts:119-124`) calls `updateRequest()` with the best-matched `bestId`. If `bestId` is stale (request was already completed by another agent between the SELECT at line 101 and the UPDATE at line 120), the update silently overwrites the status — or if the row was deleted, silently does nothing.

### 2. Fuzzy matching is coarse

The fuzzy-match algorithm (`src/lib/session-subscribers.ts:112-118`) splits the completed_item string into words and counts how many appear in the request task. Threshold is 0.3 (`session-subscribers.ts:117`). A 3-word completion like "update agent config" would match any request containing just one of those common words. No tiebreaking beyond score — first-best wins.

### 3. Best-effort error swallowing

Both the `new_items` loop (`src/lib/session-subscribers.ts:90-92`) and the `completed_items` block (`src/lib/session-subscribers.ts:129-131`) catch all errors and only `log("warn", ...)`. A schema corruption or disk-full error would be silently swallowed, with the session appearing to complete normally.

### 4. Concurrency is handled by SQLite WAL

`getDb()` sets `busy_timeout = 5000` (`src/lib/requests.ts:240`) and WAL mode (`src/lib/requests.ts:239`). Two agents completing the same request simultaneously: both SELECT pending requests, both find the same match, both UPDATE it to COMPLETED. Second write overwrites first (last-writer-wins). No data loss, but the `summary` field may reference the wrong session.

## Recommended Action

**No immediate fix needed.** The blast radius is limited to request metadata accuracy, not system behavior. If request tracking becomes load-bearing (e.g., used for billing or SLA), add:
1. Check `changes > 0` after `updateRequest()` and log a warning if 0.
2. Raise the fuzzy threshold to 0.5 or add Levenshtein distance.
3. Use `UPDATE ... WHERE status IN ('CREATED','IN_PROGRESS')` to prevent double-completion overwrites.
