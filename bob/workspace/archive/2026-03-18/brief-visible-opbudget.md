# Brief: Visible OpBudget (Common Sense Infra)

**Context**: 
`agents/shared/common-sense.md` Section 6.1 ("Respect your budget") requires agents to be efficient. Currently, `manager.ts` enforces `opBudget`, but agents have no visibility into how much budget remains until they hit the limit or see a warning. This makes planning (Section 2.1) difficult.

**Objective**: 
Expose the remaining `opBudget` to the agent in a way that allows them to make informed decisions (e.g., "I have 5 ops left, I should wrap up" vs "I have 50 ops, I can explore").

**Requirements**:
1. **Visibility**: The `opBudget` (remaining or total/used) should be visible in the agent's context.
   - Option A: Inject into the system prompt (might be stale if not updated).
   - Option B: Inject into the `heartbeat` task description (fresh at start of session).
   - Option C: Return as part of tool outputs (e.g., `Tool output (Budget: 45/50 ops)`).
   - **Recommendation**: Option B (Heartbeat injection) is simplest for now. Option C is better long-term but requires changing all tool returns. Let's start with B.

2. **Mechanism**:
   - Update `agents/shared/heartbeat.md` or the `manager.ts` logic that generates the initial user message to include: `[OpBudget: N remaining]`.
   - OR: Create a `check_budget` tool? No, that wastes an op.
   - **Preferred**: `manager.ts` already tracks budget. When calling `run()` or `input()`, inject the budget status into the context sent to the model.

3. **Behavioral Update**:
   - Once visible, Coach should update training to teach agents: "Check your budget. If < 5 ops, finish immediately."

**Action for Tech-Lead**:
- Modify `src/lib/manager.ts` (or relevant session handler) to inject `Current OpBudget: X/Y` into the system prompt or the first user message of the session.
- Ensure it updates (or at least is accurate at session start).

**Success Criteria**:
- Agents can see their budget at the start of a heartbeat.
- Agents stop hitting "OpBudget Exceeded" errors because they self-regulate.
