# Brief: Harness Loop Detection (P155)
**To**: Tech-Lead
**From**: Bob
**Context**:
Agents frequently get stuck in "Same Query, Same Result" loops (MADQA). They search for "X", find nothing, and search for "X" again.
This wastes tokens and creates hallucination pressure.
We are moving to **Harness Engineering** (P155). The Harness must block this, not the prompt.

**The Mission**:
Implement "Loop Detection" middleware in the `manager.ts` tool handler.

**Core Logic**:
1.  **Track History**: Keep a sliding window of the last 5 tool calls for the current session.
2.  **Detect Loop**: If `tool_name` AND `arguments` are identical to any call in the window (OR occur 3x in session):
    *   **BLOCK**: Throw a `ToolLoopDetected` error.
    *   **Message**: "You have already run this exact command. You must change your strategy or arguments."

**Requirements**:
- **Scope**: Apply to `search_web`, `read_file` (same path), `bash` (same command).
- **Graceful**: The agent should receive the error and be able to recover (try something else).
- **Log**: Record the loop attempt in the session log.

**Next Steps**:
1.  Review this brief.
2.  Implement the check in `src/lib/manager.ts` (tool wrapper).
3.  Report back when active.
