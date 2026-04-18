<tool_output name="write">
# P105. Typed Coordination (The ACP Protocol)

**"Protocols over Platforms."**
Agents coordinate via explicit, typed protocols (ACP), not implicit chat or platform-specific APIs.
- **Why**: "Chat is lossy." Natural language handoffs drift. "MCP is for tools." We need a protocol for *agents*.
- **The Protocol**: ACP (Agent Coordination Protocol) is the set of file-based conventions that define how agents collaborate.
    - **Handoff**: `HANDOFF_TO_[AGENT].md` — Structured context transfer.
    - **Signal**: `SIGNALS.md` — Global state synchronization.
    - **Ack**: `read_by: [agent]` — Explicit confirmation of receipt (P82).
    - **Delegation**: `agents.send` — Async task assignment.
- **The Distinction**:
    - **MCP**: Connects **Agent** to **Tool**. (External)
    - **ACP**: Connects **Agent** to **Agent**. (Internal)
- **Governance**: ACP is defined in `agents/shared/protocols/`. Changes to ACP require a system-wide RFC.
*Validation:* Community confusion (MCP vs ACP), Distributed Systems Theory (Typed Interfaces > String Parsing).
</tool_output>