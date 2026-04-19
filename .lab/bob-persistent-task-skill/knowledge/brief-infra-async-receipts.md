# Design Brief: Async Receipts for `send()` (Closing the Loop)

**Status**: Proposed
**Owner**: Bob
**Target**: Tech-Lead

## 1. The Problem
The `agents.message(agent, message)` tool is currently **fire-and-forget**.
- The sender adds a todo item to the receiver.
- The sender gets no feedback when the item is completed.
- To know if it's done, the sender must manually poll the receiver's `todo.md` or wait for a human to intervene.

This violates **C40 (Promise-Deliver-Report)** at the system level: we have Promise (send) and Deliver (receiver works), but no Report back to the sender.

## 2. The Solution: Async Receipts
Upgrade the `send()` mechanism to support a "Receipt Request" pattern.

### Mechanism
1. **Sender**: `agents.message("may", "Update roadmap...", { track: true })`
   - System generates a `trackingId` (e.g., `req_123`).
   - System appends to May's todo: `[ ] Update roadmap... (req_123)`.
   - Tool returns: `Pending: req_123`.

2. **Receiver (May)**: Works on the task.
   - Marks todo done: `[x] Update roadmap... (req_123)`.

3. **System (Cron/Handler)**:
   - "Receipt Scanner" job runs periodically (or triggered by todo update).
   - Detects `[x] ... (req_123)`.
   - Looks up the sender of `req_123`.
   - **Action**: Sends a notification back to the sender's `todo.md` or `notifications.md`:
     `[INFO] Task 'Update roadmap...' (req_123) completed by May.`

### Benefits
- **Closure**: Senders know when async work is done.
- **No Polling**: Senders don't need to waste ops reading other agents' todo lists.
- **Chaining**: Enables "Send -> Wait -> Act" workflows across sessions.

## 3. Implementation Plan

### Phase 1: Tracking IDs (Low Effort)
- Update `agents.message()` to append a unique ID `(req_<hash>)` to the message string.
- Update `agents.message()` return value to include this ID.

### Phase 2: Receipt Scanner (Medium Effort)
- Create a simple cron job (`agents/may/handlers/scan-receipts.ts`).
- Scans all `todo.md` files for `[x] ... (req_...)`.
- Checks a `.state/pending-receipts.json` ledger.
- If match found:
  - Writes completion to `.state/completed-receipts.jsonl`.
  - (Optionally) writes to sender's todo.

## 4. Immediate Action
- Tech-Lead: Review this brief.
- Tech-Lead: Implement Phase 1 (IDs) first.
