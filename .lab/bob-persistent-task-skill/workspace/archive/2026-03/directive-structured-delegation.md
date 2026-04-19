# Directive: Structured Delegation (C4.1 Infrastructure)

**Context**: Coach reports that vague delegation is a major failure mode. Agents send tasks like "Fix this" without attaching necessary context files or defining success criteria. This leads to "Context Hops" where the receiver has to spend turns discovering what the sender already knew.

**Problem**: The `send` tool schema is too loose. It allows string-only messages.

**Solution**: Update the `send` tool schema (or wrap it) to enforce C4.1 "Handoff Protocol".

**Requirements**:

1.  **Schema Update** (if possible in `src/lib/tools/agents.ts`):
    Add optional but recommended fields:
    - `context_files`: Array of strings (paths to files the receiver MUST read).
    - `success_criteria`: String (what specific condition defines "done").
    - `priority`: Enum (low, normal, high).

2.  **Validation Logic**:
    - If `context_files` are provided, verify they exist on disk before sending.
    - If `success_criteria` is missing, append a warning prompt to the sender? (Maybe too aggressive for v1).

3.  **Receiver Experience**:
    - When an agent receives a message, the system prompt should inject the `context_files` content (or at least paths) prominently.

**Implementation Options**:
A. **Modify `agents` tool**: Harder, requires touching `pi-agent-core` or `src/lib/tools/agents.ts`.
B. **New `delegate` tool**: Easier, userland tool that wraps `agents.send`.
   - `delegate({ to: "tech-lead", task: "...", context_files: ["..."], success_criteria: "..." })`
   - Internally constructs a structured message:
     ```
     [DELEGATION]
     Task: ...
     Context Files:
     - agents/bob/workspace/brief.md
     - src/lib/manager.ts
     Success Criteria: ...
     ```
   - Calls `agents.send`.

**Recommendation**: **Option B (New Tool)**. It's safer, doesn't break existing `send` usage, and can be iterated on in userland.

**Action**: Implement `src/lib/tools/delegate.ts` and register it in `agent.json` for all agents.
