# Design Brief: Auto-Inject Available Tool Names

**Context**: Common Sense 4.5 ("Know your tools").
**Problem**: Agents often hallucinate tools or use wrong names because they rely on static `TOOLS.md` or memory, which can drift from the actual runtime state.
**Solution**: The system should authoritatively tell the agent *exactly* what tools are available in the current session context.

## The Mechanism
**"Runtime Tool Injection"**

Modify `AgentLoader` or `ChatSession` to inject a system message (or prepend to the system prompt) containing the **exact list of registered tool names** at the start of the session.

### Implementation Logic
1. **Source of Truth**: The `toolRegistry` in `src/lib/tools/index.ts` (or wherever the agent's specific toolset is defined).
2. **Injection Point**: When initializing the session context (system prompt construction).
3. **Format**:
   ```
   [SYSTEM]
   Available Tools: read, write, edit, bash, agents, handoff.
   (Do not use tools not listed here.)
   ```

### Requirements
- **Dynamic**: Must reflect the *actual* loaded tools for that specific agent role (e.g., Bob gets `read/write/edit/bash/agents/handoff`, but a restricted agent might get fewer).
- **Lightweight**: Just the names. The definitions are already in the schema, but the *list* reinforces availability.
- **Update `common-sense.md`**: Once implemented, update item 4.5 to "Infra (Bob): IMPLEMENTED".

## deliverables
1. Update `src/app/agent-loader.ts` (or relevant context builder) to append the tool list to the system instructions.
2. Verify that `TOOLS.md` is no longer the sole source of truth for *existence*, only for *documentation*.
