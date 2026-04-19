## Brief: Implement Operation-Bounded Credentials (RCC) for Delegations

**Why**: "Velocity Vulnerability" ($V_v = v \cdot TTL$) means fast agents can cause unbounded damage within a time-based window.
**Goal**: Shift from Time-based (120s) to Operation-based (N ops) bounds for agent delegations.
**Principle**: P162 Resource Intent (Deterministic Safety).

### 1. The Mechanism
Instead of `timeout: 120000`, the `manager.run` and `agents.call` interfaces should accept `opLimit: number`.

**Proposed Interface**:
```typescript
interface RunOptions {
  timeout?: number;  // Wall-clock safety net (keep for hung processes)
  opLimit?: number;  // Deterministic tool-call limit (e.g., 50)
}
```

### 2. Implementation Logic
1.  **Counter**: `ChatSession` maintains `opCount` (tool executions since start of task).
2.  **Check**: Before executing any tool, `manager` checks `opCount < opLimit`.
3.  **Revocation**: If `opCount >= opLimit`:
    *   Block tool execution.
    *   Return error: `Error: Operation Limit Exceeded (50/50). Request re-authorization.`
    *   Agent must `finish({ status: "blocked", reason: "OpLimit" })`.

### 3. Application
*   **Coder**: Default `opLimit: 50`. Enough to fix a bug, not enough to delete a repo.
*   **Scout**: Default `opLimit: 20`. Enough to browse, not enough to scrape the web.
*   **QA**: Default `opLimit: 100`. Enough to run test suites.

### 4. Next Steps
1.  Tech-Lead: Update `ChatSession` to track `opCount`.
2.  Tech-Lead: Update `manager.ts` to enforce `opLimit`.
3.  Tech-Lead: Expose `opLimit` in `agent.json` config (default per agent).

**Handoff**: Please implement this in `src/lib/manager.ts` and `src/app/chat-session.ts`.
