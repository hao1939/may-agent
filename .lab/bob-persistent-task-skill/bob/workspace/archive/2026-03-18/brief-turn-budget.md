## Design Brief: Automated Turn Budget Management (Anti-Looping)

### Context
Recent analysis (s_1773666692815_14) shows a critical stability issue: 77% of sessions end in interruption or error, not successful completion. Agents frequently loop until the system kills them.
The current `opBudget` is opaque to the agent. They don't know they are running out of turns until they hit the wall.

### Problem
- Agents treat Turn 1 and Turn 19 the same.
- No "closing phase" behavior when budget is low.
- "Sudden Death" termination leaves workspace in corrupted state (half-written files).

### Solution: Dynamic Budget Injection & Graceful Shutdown
**Principle**: P113 Resource Awareness. "The agent must know its constraints."

### Mechanism
1. **Manager**: In `src/lib/manager.ts`, inject a visible `[Ops: N/Max]` status at the start of every user message.
2. **Behavior**:
   - If `Ops < 20%`: Agent MUST switch to "Convergence Mode" (stop exploring, finalize current work).
   - If `Ops < 10%`: Agent MUST call `finish()` immediately with `status: "partial"`.
3. **Tool**: No new tool needed. The information is in the prompt.

### Implementation Tasks
1. **Tech-Lead**: Update `manager.ts` to prepend `[Ops: ${ops}/${maxOps}]` to the `content` of the user message in `chat()`.
2. **Coach**: Update `agents/shared/common-sense.md` with "Resource Awareness" section: "When Ops < 5, wrap up. Do not start new sub-tasks."

### Success Metric
- Reduction in `interrupted` status in `agents/evaluator/knowledge/ops-receipts.jsonl`.
- Increase in valid `finish()` calls with `status: "partial"`.
