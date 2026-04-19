# Design: L3 Delegation Metrics (Inter-Agent Reliability)

**Problem:** We have zero visibility into inter-agent reliability. When `agents.call()` fails, is it a timeout, a crash, or a logic error? Which agent pairs are most fragile?
**Solution:** A lightweight, structured log of every delegation event (`call` or `send`). This provides the raw data for L3 Collective Autonomy Defense (drift detection, reliability tracking).

## 1. Schema
Log file: `.state/delegations.jsonl` (append-only)
Rotation: standard log rotation (keep last 5 files, 10MB each)

**JSON Structure:**
```json
{
  "timestamp": "ISO-8601",
  "traceId": "uuid-v4",          // Unique ID for this specific call
  "sessionId": "string",         // The session where the call originated
  "parent": "agent-name",        // Who made the call
  "child": "agent-name",         // Who was called
  "method": "call" | "send",     // Synchronous or Fire-and-Forget
  "status": "success" | "error" | "timeout",
  "durationMs": 1234,            // null for 'send'
  "error": "string"              // Optional error message
}
```

## 2. Implementation (`src/lib/manager.ts`)
Wrap the existing `agents.call` and `agents.send` methods.

### A. `call(agent, task)` wrapper
1. Generate `traceId`.
2. Log `{ ... "status": "pending" ... }` (optional, for debugging hangs).
3. `try { result = await ... } catch (e) { ... }`
4. Calculate duration.
5. Log `{ ... "status": "success/error", "durationMs": ... }`.
6. Return result or re-throw error.

### B. `send(agent, message)` wrapper
1. Generate `traceId`.
2. Log `{ ... "status": "sent" ... }`.
3. `agents.send(...)` is fire-and-forget, so no duration/result logging needed (unless `send` itself throws).

## 3. Usage
- **Evaluator:** Reads `.state/delegations.jsonl` to calculate "Reliability Score" for each agent pair (e.g., May->Coder success rate).
- **Optimizer:** Uses data to identify bottlenecks (high duration) or fragile links (high error rate).

## 4. Constraint Checklist & Confidence Score
1. **Design Principle Alignment?** Yes. P18 (Measurable Operations), P6 (No Silent Failures).
2. **Complexity?** Low. 20-30 lines of wrapper code in `manager.ts`. No new dependencies.
3. **Impact?** High. Enables L3 defense visibility for the first time.
4. **Confidence Score:** 5/5.

## 5. Next Steps
- Delegate to **Tech-Lead** to implement in `src/lib/manager.ts`.
