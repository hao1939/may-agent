# Brief: Common Sense Infra — Auto-Inject Tool Names

## Context
Common Sense item 4.5 requires agents to "Know your tools." Currently, agents rely on `TOOLS.md` or memory, which can be stale or hallucinated. The system knows exactly what tools are available at runtime. We should inject this truth directly into the session context.

## Design
1. **Mechanism**: In `agent-loader.ts` or `chat-session.ts`, when constructing the system prompt or initial context:
   - Dynamically list the names/signatures of all tools registered for the agent.
   - Inject this list into a "Runtime Context" block in the system instructions.
2. **Benefit**:
   - Eliminates "I don't have that tool" errors when tools are added/renamed.
   - Prevents hallucinations of non-existent tools.
   - Reduces reliance on manually updating `TOOLS.md`.

## Deliverables
1. Update `agent-loader.ts` to generate the tool list.
2. Update system prompt template to include `${availableTools}`.

## Verification
- Start a session.
- Check if the system prompt contains the accurate list of tools.
