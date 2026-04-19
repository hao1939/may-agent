# QA Proactive Review — commit 858a334 (Auto-complete injected send() requests)

## Scope / Evidence
- Commit: `858a334` — “Auto-complete injected send() requests after successful heartbeat” (`git show --name-only 858a334`).
- File reviewed: `src/app/cron.ts` (read via `functions.read` offsets 1, 200, 460).
- Repo gates: `npx tsc --noEmit` exit 0; `npx vitest --run` PASS (1371 tests).

## What changed (observed)
- `Cron.fireHeartbeat()` now gathers `injectedRequestIds` for pending `send` requests injected into the heartbeat prompt, and after `manager.waitFor(sessionId)` resolves successfully it **auto-updates** each injected request to `COMPLETED` with a summary referencing the heartbeat sessionId.
- On heartbeat failure (`catch`), injected requests are left untouched so they can be retried.

## Findings
### IMPORTANT — Possible incorrect completion of requests that are still in-progress
**Where:** `src/app/cron.ts`, inside `fireHeartbeat()` success handler, the loop:
```ts
for (const reqId of injectedRequestIds) {
  updateRequest(..., { status: "COMPLETED", ... })
}
```
**Risk:** The query collects requests with `status IN ('CREATED','IN_PROGRESS')` and `method='send'`. If a `send` request is already `IN_PROGRESS` (e.g., the agent started acting on it but hasn’t finished), this code will still mark it `COMPLETED` purely because a later heartbeat finished. That can create **false completion** and hide outstanding work.
**Suggested fix direction:** Only auto-complete requests that were `CREATED` at injection time, or record which requestIds were injected and still `CREATED` at completion time (re-check status before updating). Alternatively, store a linkage like `injectedIntoSessionId` without changing status.

### IMPORTANT — Race: auto-completing requests created after injection
**Where:** same query that selects all pending sends at injection time.
**Risk:** If a new `send` request arrives during the heartbeat and matches the same agent, it is **not** in `injectedRequestIds` and won’t be auto-completed; that’s fine. But the inverse risk is more relevant: the auto-completion loop doesn’t verify the request was actually injected in this session beyond being in the captured array.
**Note:** The capture happens immediately before `manager.run()`, so this is probably OK, but a re-check before update would make it robust.

### MINOR — Swallowed DB errors reduce debuggability
**Where:** the injection query is wrapped in `try { ... } catch { /* Non-fatal */ }`.
**Risk:** If DB is misconfigured/corrupted, heartbeats silently skip pending-task injection and also silently skip capturing `injectedRequestIds`. Consider logging via `this.onError?.(...)` at least once per failure class.

## Overall
The change matches the commit message intent and tests are green, but the auto-completion semantics look too broad: completing `IN_PROGRESS` requests seems incorrect for “injected send() requests” (those are not guaranteed to be *done* when the heartbeat completes).
