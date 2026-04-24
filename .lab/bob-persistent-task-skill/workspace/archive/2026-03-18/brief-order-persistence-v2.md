# Design Brief: Order Persistence (The "Durable Queue")

**Status**: Proposed
**Author**: Bob (Architect)
**Target**: Tech-Lead
**Priority**: Critical (Prevents loss of human intent)

## 1. Problem Statement
When the human issues a command (via console, socket, or Telegram), the system immediately spawns a session to handle it.
- **The Failure Mode**: If that session crashes (OOM, API timeout, unhandled exception), the session is marked `error` (or vanishes), and the human's command is **lost**.
- `human-inputs.jsonl` exists but is a passive log, not an active queue. May does not read it to retry tasks.
- **Impact**: "I told May to do X, she crashed, and now she forgot."

## 2. Core Principle: Intent Persistence (P209)
"Human intent must be persisted to disk *before* execution begins. Execution is ephemeral; intent is durable."

## 3. Architecture Design

### Component A: The Order Ledger (`.state/orders.jsonl`)
We need a **Durable Queue** for incoming commands.

**Schema**:
```typescript
interface OrderTicket {
  orderId: string;       // ord_123...
  source: "console" | "telegram" | "socket";
  input: string;         // "Analyze the logs"
  targetAgent: "may" | "coach" | ...;
  status: "pending" | "processing" | "completed" | "failed";
  sessionId?: string;    // Linked session (if started)
  createdAt: number;
  updatedAt: number;
  attempts: number;
}
```

### Component B: The Interceptor (Manager Update)
Modify `manager.run` (and `manager.input`) to persist before executing.

**Flow**:
1. **Receive**: Manager gets input from generic interface.
2. **Persist**: Generate `OrderTicket` (status: `pending`). Append to `.state/orders.jsonl`.
3. **Execute**: Spawn the session.
   - Link `sessionId` to `OrderTicket`.
   - Update `OrderTicket` status to `processing`.
4. **Finalize**:
   - On `session.status = "done"`, update Order to `completed`.
   - On `session.status = "error"`, update Order to `failed` (or `pending` if retriable).

### Component C: The Watchdog (May's Recovery Loop)
May needs a new periodic skill/task to sweep the ledger.

**Logic (inside `recover_orders` skill)**:
1. Read `.state/orders.jsonl`.
2. Find Orders where:
   - `status == "pending"` (Never started)
   - `status == "processing"` AND `updatedAt < NOW - 10m` (Stalled/Crashed)
   - `status == "failed"` AND `attempts < 3` (Retriable)
3. **Action**:
   - If Stalled: Check if session is actually dead. If yes, mark `failed` and increment attempts.
   - If Pending/Retriable: Re-submit to `manager.run` (with a flag to link to *existing* orderId, avoiding infinite loops).
   - If Failed (Max Attempts): **Escalate** to `agents/may/workspace/failures.md` or Telegram alert.

## 4. Implementation Specification

### 4.1 Integration with `manager.ts`
- **Ingest**: In `startSession` or `runAgent`.
- **Update**: In `handleCompletion`.

### 4.2 Integration with Delegation Ledger
- This can be merged with `delegations.jsonl` (from Session Drop Recovery brief) into a unified `work-items.jsonl` if desired, OR kept separate for clarity.
- **Recommendation**: Keep separate for MVP (`orders.jsonl` = Human, `delegations.jsonl` = Agent). Human orders have higher priority and different timeouts.

### 4.3 The "Replay" Prevention
- Ensure the "Recovery" logic doesn't just spawn infinite loops of crashing sessions.
- **Hard Limit**: `attempts: 3`.
- **Backoff**: Wait 5m before retrying a crashed order.

## 5. Action Plan
1. **Tech-Lead**: Implement `logOrder` in `manager.ts` (Persist-First pattern).
2. **Tech-Lead**: Implement `updateOrder` in `handleCompletion`.
3. **Tech-Lead**: Implement `recover-orders` skill for May.
4. **May**: Add `recover-orders` to `cron.json` (Every 5 mins - high frequency).

## 6. Success Metrics
- **Order Loss Rate**: 0% (Even if session crashes, order remains in Ledger).
- **Recovery Latency**: < 10 mins.
