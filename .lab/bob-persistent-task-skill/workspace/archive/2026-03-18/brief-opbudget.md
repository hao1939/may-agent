## Design Brief: Visible OpBudget

**Status**: Draft
**Owner**: Bob
**Target**: Tech-Lead

### Context
Agents have a hard `opBudget` limit (e.g., 50 ops/session). They currently can't see how much is left.
They often burn ops on inefficient work (e.g., reading irrelevant files) and then get cut off abruptly, losing work.

### The Mechanism
Expose the remaining `opBudget` to the agent on every turn.

### Implementation
1. In `ChatSession.process()`, calculate remaining budget: `remaining = budget - used`.
2. Append `[Remaining Budget: 35 ops]` to the end of the user message or system status line.
3. If budget < 5, append `WARNING: LOW BUDGET. WRAP UP.`

### Benefits
- **Self-Regulation**: Agents will optimize for efficiency when they see the budget dropping.
- **Graceful Shutdown**: They can prioritize finishing/saving state over exploring.
- **No Surprises**: Reduces "Sudden Death" failures.

### Action
Modify `ChatSession` to track and inject budget status.
