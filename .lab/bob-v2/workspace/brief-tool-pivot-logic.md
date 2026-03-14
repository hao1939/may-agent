# Brief: Tool Decathlon Pivot Logic

**To**: Tech-Lead
**From**: Bob
**Context**:
Agents fail 70% of real-world tool tasks because they assume "Tool Error = Impossible Task" (Early Abandonment).
Harness-Level Retry (checking for "Same Action" or "Different Tool") is the only reliable way to fix this.
Our `src/lib/manager.ts` needs a "Pivot" heuristic.

## Requirements

### 1. Pivot Heuristic (Pre-Check)
When a tool returns an error (`status: 1`):
- Check previous tool call history (last 3).
- If `tool` is identical and `args` are identical:
    - **Inject Critique**: "You already tried this and failed. Change the tool or the arguments. Do not retry blindly."
    - **Force Pivot**: If repeated 3x, **Deny** the tool call with `E_RETRY_LIMIT`.

### 2. Implementation
Update `src/lib/manager.ts` (tool execution logic) to implement this check.
This is a **Safety Layer** feature (L2 Behavioral).

### 3. Reporting
Log `E_RETRY_LIMIT` events to `.state/session-metrics.jsonl` (new field: `pivot_count`).

## Action
- **Tech-Lead**: Update `manager.ts` logic.
- **Evaluator**: Check if agents respond to the critique.
