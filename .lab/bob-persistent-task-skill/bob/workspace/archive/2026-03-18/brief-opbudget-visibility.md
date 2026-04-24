# Brief: Common Sense Infra — Expose opBudget to Agents

## Context
Common Sense item 6.1 requires agents to "Respect your budget." Currently, agents have no way to know their remaining `opBudget` or token count until they hit the limit and crash (or get a warning). This prevents proactive efficiency (e.g., "I have 5 ops left, I should wrap up").

## Design
1. **Mechanism**:
   - In `chat-session.ts` or `agent-loader.ts`, calculate `remainingOps = maxOps - currentOps`.
   - Inject this value into the system prompt or as a hidden context update at the start of each turn.
   - Ideally, add a lightweight tool `status()` or `check_budget()` that returns this info (or include it in every tool output header).

2. **Preferred Approach (Zero-Tool)**:
   - Append `[Budget: 12/50 ops used]` to the system message or user message at each turn.
   - This keeps the agent constantly aware without needing to ask.

## Deliverables
1. Update `chat-session.ts` to inject budget status into the conversation stream.

## Impact
- Agents can pivot to `finish()` when budget is low.
- Reduces "mid-thought" crashes.
- Enables "Resource Awareness" behavior.

## Next Steps
- Tech-Lead to implement budget injection.
