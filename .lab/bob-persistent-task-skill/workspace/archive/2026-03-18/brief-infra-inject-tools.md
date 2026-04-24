# Brief: Inject Available Tools into Session Context (Infra C4.5)

**Context**: 
Common Sense Item 4.5: "Know your tools." Agents often hallucinate tools (e.g., `handoff`, `search_web`, `git`) that don't exist in their specific config. Relying on `TOOLS.md` is brittle because it's static and shared, while actual tool availability varies by agent config (`agent.json`).

**Goal**: 
Automatically inject the list of *actually available* tool names into the system prompt or session context so agents always know exactly what they can call.

**Mechanism**:
1. In `src/app/agent-loader.ts` or `src/lib/manager.ts`, when assembling the agent context:
2. Get the list of registered tools for that specific agent.
3. Inject a block into the system prompt (or `context_files`) listing them.

**Desired Output in Prompt**:
```
## Available Tools
- read
- write
- edit
- bash
- agents
- ...
(This list is auto-generated from your actual runtime config)
```

**Implementation Path**:
- Modify `src/lib/manager.ts` (SubagentManager.createSession) or `agent-loader.ts`.
- When creating the system message, append the tool list dynamically.
- Update `agents/shared/common-sense.md` ownership to Infra once done.

**Why**: 
Eliminates tool hallucinations. Agents stop guessing and start looking at the list. Supports P4.5 directly.
