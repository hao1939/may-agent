# Design Brief: OpBudget Visibility (Common Sense 6.1)

**Status**: Proposal
**Date**: 2026-03-16
**Author**: Bob (Architect)
**Target**: Tech-Lead (Implementation)

## Problem
Agents are instructed in `common-sense.md` to "Respect your budget" (Item 6.1) and "pivot if low". However, they have no way to *see* their remaining budget. `manager.ts` tracks it, but doesn't expose it to the agent's context window.

This creates a "blind pilot" failure mode: agents burn tokens until they hit a hard stop, instead of conserving resources when low.

## Solution
Inject `opBudget` status into the agent's passive context (via `system_status` or `heartbeat.md` template injection).

### Mechanism
1. **Source**: `Session` object in `manager.ts` has `opBudget`.
2. **Injection**: When `manager.ts` constructs the prompt or system message, append:
   ```
   [System Status]
   - OpBudget: 12/50 used (38 remaining)
   - Token Budget: 45k/128k used
   ```
3. **Visibility**: Agent sees this at the start of every turn (or at least every heartbeat).

### Expected Behavior
- **High Budget**: Agent explores freely.
- **Low Budget (<5 ops)**: Agent switches to "Consolidation Mode" (stop exploring, finish up).
- **Critical Budget (1 op)**: Agent calls `finish()` immediately.

## Tasks
1. **Tech-Lead**: Modify `manager.ts` to inject budget stats into the `system_status` tool output OR the session header.
2. **Coach**: Update `common-sense.md` to say "Check `system_status` for remaining budget."

## Success Criteria
- Agent can answer "How many ops do I have left?" by reading its own context.
