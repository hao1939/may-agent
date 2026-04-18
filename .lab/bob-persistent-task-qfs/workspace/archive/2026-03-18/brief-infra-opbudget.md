# Design Brief: Common Sense Infra — OpBudget Visibility

**Status**: Ready for Handoff
**Owner**: Bob
**Target**: Tech-Lead

## Context
Agents have a hard OpBudget (e.g., 50 turns/ops). Currently, they have **no visibility** into how much budget remains. They work blindly until they hit the wall and crash/stall.

**Common Sense Gap**: "Respect your budget" (Item 6.1 in `agents/shared/common-sense.md`).

## Design
Expose the remaining OpBudget to the agent in every turn, so it can make informed trade-offs (e.g., "I have 5 ops left, I should wrap up" vs "I have 40 ops, I can explore").

### Mechanism
1. **Tracking**: `Session` object already tracks `opsCount` and `opBudget`.
2. **Injection**: In `manager.ts` -> `runTurn`, inject a system message or status line.
3. **Format**:
   - **Option A (System Message)**: Prepend to user/tool output: `[SYSTEM: OpBudget 12/50 remaining]`
   - **Option B (Prompt Variable)**: `{{OP_BUDGET_REMAINING}}` in system prompt (less effective for real-time awareness).
   - **Recommendation**: Option A. It's a "dashboard" element visible in the stream.

### Implementation Steps
1. In `manager.ts`, calculate `remaining = opBudget - opsCount`.
2. When constructing the context for the next turn, insert `[Status: Ops ${opsCount}/${opBudget}]` into the message history or system instruction.
3. Add a "Low Budget Warning" trigger: if `remaining < 5`, inject a sterner warning: `[WARNING: 5 Ops remaining. Finish up.]`

### Benefits
- **Graceful Shutdown**: Agents can call `finish()` before being killed.
- **Prioritization**: Agents won't start a huge refactor with 3 ops left.

## Success Criteria
- [ ] Agent sees "Ops: 10/50" in context.
- [ ] Agent triggers `finish()` when warning appears.
- [ ] Hard kills reduce by 50%.
