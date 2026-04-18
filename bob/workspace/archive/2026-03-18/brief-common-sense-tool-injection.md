# Design Brief: Common Sense Infra (Auto-Inject Tools)

**Status**: Proposed
**Owner**: Bob
**Source**: `agents/shared/common-sense.md` (Item 4.5)

## Context
Item 4.5 in Common Sense requires agents to "Know your tools." Currently, agents rely on `TOOLS.md` or memory, which can drift from the actual runtime state of `agent.json`. If a tool is added or removed, the agent might not know until it tries and fails.

## Proposal
Implement automatic tool injection into the agent's system prompt or session context.

### Mechanism
1. **Source of Truth**: The `Agent` object in `manager.ts` knows exactly which tools are loaded (via `agent.tools`).
2. **Injection Point**: When `manager.ts` constructs the system prompt or the initial user message for a session, it should append a dynamic list of available tool names and signatures.
3. **Format**:
   ```
   ## Available Tools (Auto-Generated)
   - read(path, options?)
   - write(path, content)
   - bash(command)
   ...
   ```

### Benefits
- **Drift Elimination**: The agent always sees the exact tools available in that specific session.
- **Hallucination Reduction**: Agents won't try to use tools they *think* they have but don't.
- **Simplification**: We can remove the manual `TOOLS.md` maintenance burden.

## Actions for Tech-Lead
1. Modify `src/lib/manager.ts` (or `agent-loader.ts`) to generate a tool summary string from the loaded tool definitions.
2. Inject this summary into the agent's context (e.g., appended to `system_instructions` or as a distinct context block).
3. Verify that `TOOLS.md` is no longer the primary source of truth for tool availability (though it may remain for detailed documentation).

## Definition of Done
- When an agent starts a session, the transcript includes a system-generated block listing the currently loaded tools.
- Removing a tool from `agent.json` immediately removes it from the agent's visible list in the next session.
