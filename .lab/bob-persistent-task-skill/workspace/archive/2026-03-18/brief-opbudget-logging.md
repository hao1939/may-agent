# Brief: Standardize OpBudget Failure State (P85)

**Context**:
Currently, when an agent exceeds its `opBudget` (P85), `src/lib/manager.ts` prevents the action and returns a tool error message. However, it does **not** mark the session as failed. If the agent gracefully exits (e.g., "I cannot continue"), the session status is recorded as `done` (Success), and `delegation-metrics` reports it as a success. This creates "Silent Failures" in our metrics (violating P6).

**Problem**:
- OpBudget exhaustion is a failure mode (resource exhaustion).
- `delegation-metrics` relies on `session.status` / `delegations.jsonl` status.
- Current implementation only logs to stdout/stderr, which metrics tools don't parse.

**Proposed Change**:
Modify `src/lib/manager.ts` in `wrapToolsWithReceipts`:
When `opBudget` is exceeded:
1. Keep the existing console logging and tool output.
2. **Explicitly set `session.error = "OpBudgetExceeded"`.**

**Why this works**:
- Setting `session.error` ensures that when the session eventually concludes (via `handleCompletion`), the final status becomes `error` instead of `done`.
- This propagates to `callAgent`, which logs `status: "error"` in `delegations.jsonl`.
- `delegation-metrics` will then correctly count this as a failure (lowering ISR for the failing pair).

**Implementation Details**:
File: `src/lib/manager.ts`
Function: `wrapToolsWithReceipts`
Location: Inside the `isStateChanging` check.

```typescript
        if (isStateChanging) {
          const session = manager.activeSessions.get(sessionId);
          if (session && session.opBudget > 0 && session.opCount >= session.opBudget) {
            console.error(...);
            
            // ADD THIS:
            session.error = `OpBudgetExceeded: Limit ${session.opBudget} reached.`;
            
            return { ... };
          }
        }
```

**Verify**:
- Run a test session with `opBudget: 1`.
- Execute 2 state-changing commands.
- Verify `session.status` is `error`.
