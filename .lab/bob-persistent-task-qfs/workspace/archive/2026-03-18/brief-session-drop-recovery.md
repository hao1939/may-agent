# Session Drop Recovery (High Priority)

**Status**: Draft
**Owner**: Bob
**Target**: Tech-Lead

## Context
When an LLM API call fails repeatedly (e.g., rate limits, timeouts), the `SubagentManager` exhausts its retries and throws an error. Currently, this error propagates up and **crashes the session**. The session enters a `stopped` or `error` state, but:
1. It is never re-queued.
2. The `onSessionBlocked` callback (if any) might not fire if the crash is unhandled.
3. The human's intent is lost.

**Severity**: 45% truncation rate, 15% error rate (Hao's data). 23 confirmed "silent deaths" where tasks just vanished.

## Problem
- **No Resurrection**: A session that crashes due to transient API issues is dead forever.
- **No Visibility**: These sessions sit in `.state/sessions/` with `status: "error"` but no active monitoring picks them up to retry.
- **Heartbeat Gap**: Agent heartbeats only look forward (new tasks), not backward (crashed tasks).

## Solution: The "Lazarus" Protocol
Implement a robust recovery mechanism that detects dropped sessions and resurrects them.

### Mechanism 1: The Watchdog (Cron)
Enhance `cron:watchdog` (currently just cancels stale sessions) to also **resurrect** sessions that died from transient errors.

**Logic**:
1. Scan `.state/sessions/history/`.
2. Find sessions where:
   - `status` is `"error"` OR (`status` is `"running"` but `lastUpdated` > 10 min ago).
   - `error` field indicates a retryable failure (e.g., "503", "429", "timeout", "network").
3. **Action**:
   - If retryable: Call `manager.resumeSession(sessionId)`.
   - If fatal (e.g., "context length exceeded"): Mark as `"failed"`, log to `failures.jsonl`, and notify May.

### Mechanism 2: The `send()` Ledger
Agents use `agents.send()` for async delegation. Currently, this is fire-and-forget.
We need a **Sender-Side Ledger**:
1. When Agent A sends to Agent B, write to `.state/delegations.jsonl`: `{ id, from, to, task, status: "pending" }`.
2. When Agent B finishes, update to `status: "done"`.
3. If Agent B crashes, the Watchdog sees the "pending" state > 10m and triggers recovery.

**(Self-Correction: This overlaps with "Activity Tracking" brief. Let's focus purely on the Recovery mechanism here.)**

### Mechanism 3: Robust `runAgent` Wrapper
In `manager.ts`:
Wrap the core `agent.run()` loop in a `try/catch` that catches the specific `MaxRetriesExceeded` error.
Instead of crashing:
1. Log the partial state.
2. Schedule a **self-heal retry** in 30 seconds (using `setTimeout` or a persistent queue).
3. If that fails, write a "CRASH DUMP" to the session log so the Watchdog can see it.

## Deliverables
1. **Update `cron:watchdog`**:
   - Add `resurrectCrashedSessions()` function.
   - Logic to distinguish "Transient" vs "Fatal" errors.
2. **Update `manager.ts`**:
   - Ensure `MaxRetriesExceeded` writes a distinctive error code to `meta.json`.

## Success Criteria
- **Zero Silent Deaths**: Every session either completes or explicitly fails with a notification.
- **Auto-Resume**: API outages cause a pause, not a crash. The system picks up where it left off.
