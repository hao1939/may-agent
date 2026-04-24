# Brief: Infrastructure - Async Receipts (P209/P110)

## Context
Tech-Lead has implemented `manager-receipts.ts` which tracks session status and errors. However, we are missing the "Async Receipt" mechanism defined in P209 and P110, which allows agents to verify if their async `agents.send()` requests were actually picked up and completed.

Currently, `agents.send()` is fire-and-forget. Agents have no programmatic way to know if the target agent ever ran the task.

## The Gap
- **P209 Async Request Tracking**: Mandates that every `send()` returns a tracking ID, and agents can query the status of that ID.
- **P110 No Silent Failures**: If a `send()` is dropped or the target fails, the sender needs to know.

## Proposed Implementation (Minimal)

1. **Database Schema Update**:
   - Ensure the request database (sqlite/jsonl) stores: `requestId`, `sender`, `target`, `status` (pending/active/done/failed), `result_summary`.

2. **Tool Update: `agents.send`**:
   - Return `{ requestId: "req-123", status: "queued" }` instead of just "Message sent".

3. **New Tool Action: `agents.requests`**:
   - Allow querying by `requestId` or `sender`.
   - Usage: `agents(action: "requests", filter: "my-requests")`
   - Output: List of recent requests with their status and result summaries.

4. **Integration with `finish()`**:
   - When an agent calls `finish()`, the system should update the status of the request that triggered the session (if any) to `done` or `failed`.

## Why This Matters
This closes the feedback loop for async delegation. Agents can now:
1. Send a task.
2. Check back later: "Did Tech-Lead finish that brief?"
3. If failed/stuck, retry or escalate.

## Next Steps
- Implement `agents.requests` query capability.
- Ensure `finish()` updates request status.
