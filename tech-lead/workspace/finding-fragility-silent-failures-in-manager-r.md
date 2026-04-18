# Lens D: Fragility — Silent Failures in Manager Retry/Error Paths

**Files examined**: `src/lib/manager-retry.ts` (431 lines), `src/lib/manager-health.ts` (202 lines)  
**Date**: 2026-04-16

## Findings

### 1. Recursive retry can stack overflow (manager-retry.ts:~340) — HIGH
`runAgentWithRetry` calls itself recursively in the post-loop empty-response catch:
```ts
return runAgentWithRetry(session, Promise.resolve(), infraRetryMax, onComplete);
```
If the agent keeps returning empty responses, this recurses once per retry cycle. With `infraRetryMax` resets (the counter isn't reset but the function re-enters the while loop), this could produce deep call stacks. In practice it's bounded by `infraRetryCount < infraRetryMax`, but the recursion pattern is fragile — a bug in counter management would cause unbounded recursion.

**Recommended action**: Refactor to iterative (outer while loop) instead of recursion.

### 2. Silent error swallowing in digest write (manager-retry.ts:~278)
```ts
upsertDigest(persistDir, { ... }).catch(err => log("warn", ...));
```
Digest write failures are caught and logged at `warn` level only. If persistence is broken, retries still happen but leave no audit trail. **Severity: LOW** — logging is present, just at warn not error.

### 3. Error state cleared before retry loses diagnostics (manager-retry.ts:~305-306)
```ts
session.error = undefined;
(session.agent.state as any).errorMessage = undefined;
```
Original error is cleared before retry. If all retries fail, `onComplete` sees only the *last* error, not the original. The first error (often most diagnostic) is lost. Only the retry count and log entries preserve it.

**Recommended action**: Accumulate errors in an array or preserve the original error.

### 4. Silent catch blocks in health audit (manager-health.ts:~108, ~116)
```ts
} catch {
  /* best-effort */
}
```
Two bare catch blocks:
- Line ~108: `readdirSync(evalDir)` failure — silently returns 0 evaluated sessions, inflating unevaluated count
- Line ~116: DB query failure — same effect

If the evaluations directory is corrupted or DB is locked, the audit silently reports wrong numbers with no indication of failure. **Severity: MEDIUM** — could cause unnecessary re-evaluation work.

**Recommended action**: At minimum log a warning. Consider adding a `warnings` array to `AuditHealthReport`.

### 5. Blocking `readdirSync` in async function (manager-health.ts:~105)
`computeAuditHealth` is async and uses `loadAllSessionMetasAsync` for sessions, but falls back to `readdirSync` for the evaluations directory. With thousands of evaluation files, this blocks the event loop.

**Severity: LOW** — evaluations dir is typically smaller than sessions dir.

### 6. `persistDir` parameter lost on recursion (manager-retry.ts:~340)
```ts
return runAgentWithRetry(session, Promise.resolve(), infraRetryMax, onComplete);
// persistDir parameter is NOT passed ↑
```
The recursive call omits `persistDir`, so all subsequent retries skip digest writes. Silent loss of audit trail.

**Severity: MEDIUM** — retries after the first post-loop catch won't have digests.

**Recommended action**: Pass `persistDir` in the recursive call.

## Summary
The most actionable fixes are **#6** (missing parameter — easy bug fix) and **#1** (recursion → iteration refactor). The silent catches in health (#4) should get at least warn-level logging.
