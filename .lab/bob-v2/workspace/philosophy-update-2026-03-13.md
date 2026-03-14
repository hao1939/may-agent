# Philosophy Update Request (2026-03-13)

Please apply the following changes to `agents/shared/philosophy.md`.

## New Principle: P86 Refresh or Fork
Add this to the **Operations** or **Execution** section (or wherever fits best, likely near P79/P67).

### 86. Refresh or Fork (P86) [imported]
**"Don't let context rot."**
Long-running sessions drift. After N turns (or when starting a new major subtask), prefer to **Refresh** (restart session) or **Fork** (spin off sub-agent).
- **The Rule**: If session > 20 turns, consider a refresh. If task switches domain, fork.
- **The Mechanism**: `agents.call("sub-agent", "fork", ...)` or simply closing the current session and starting a new one.
- **Why**: Ensures the LLM always operates on high-signal context, reducing "Lost in the Middle" errors.
*Validation:* AgentOS, GSD Pattern.

## Update: P79 The Ralph Loop
Update the validation line to include GSD.

*Validation:* ReMe, OpenViking, AutoAgent, GSD Pattern.
