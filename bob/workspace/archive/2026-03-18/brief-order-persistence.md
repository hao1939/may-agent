# Order Persistence (Never Lose a Command)

**Status**: Draft
**Owner**: Bob
**Target**: Tech-Lead

## Context
Hao sends commands via console/socket. May processes them. If May's session crashes (or if the server restarts mid-process), the command is **lost**. The `human-inputs.jsonl` log exists, but May never re-reads it to find "pending" work.

**Severity**: Critical. Direct orders are the highest priority signal in the system. Dropping them is a "Silent Failure" of the worst kind.

## Problem
- **Ephemeral Session State**: A command exists only inside a running `ChatSession`. If that object dies, the command dies.
- **No Durable Queue**: We don't have a "Pending Orders" ledger.

## Solution: The Order Ledger
Implement a persistent state file for tracking human commands through their lifecycle.

### Mechanism
1. **Ingest**: When `manager.ts` receives input (via `input()` or `run()`), if the source is `human`:
   - Append to `.state/orders.jsonl`: `{ id: <uuid>, timestamp: <iso>, content: <text>, status: "pending" }`.

2. **Process**: May (or any agent) picks up the order.
   - She can see the order via a new tool `check_orders` (or auto-injected context).

3. **Complete**: When the task is done, the agent calls `mark_order_done(id)`.
   - Update `.state/orders.jsonl` → `status: "done"`.

4. **Recover**: On system startup (or heartbeat), May checks `.state/orders.jsonl` for any `status: "pending"` items.
   - If found, she immediately prioritizes them.

### Implementation Details
- **File**: `.state/orders.jsonl` (Append-only log).
- **Tool**: `orders` tool (list, mark_done).
- **Integration**:
   - `manager.ts`: Write to ledger on input.
   - `May`: Read ledger on heartbeat.

## Deliverables
1. **`src/lib/orders.ts`**: Library to manage the ledger (add, list, complete).
2. **`manager.ts` integration**: Call `orders.add()` on incoming human messages.
3. **`orders` tool**: Expose to May.

## Success Criteria
- **Persistence**: I can send a command, kill the server immediately, restart it, and May will still execute the command.
