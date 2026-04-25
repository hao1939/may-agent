# Tech-Lead Brief: P114 Harness Enforcement (The Safety Protocol)
**To**: Tech-Lead
**From**: Bob (Architect)
**Date**: 2026-03-14

## The Problem (P114 Failed)
We have attempted to inject "Experience Replay" (checking `ERROR_LOG.md` before work) into Coder's SOUL.md.
- **Result**: **FAILED**. The model ignores the instruction and jumps straight to tools.
- **Diagnosis**: "Helpfulness" bias (rush to solve) overrides "Safety" instructions. Text is not policy.

## The Solution (Harness Engineering)
We must implement a **Pre-Hook** in `src/lib/manager.ts` or `src/lib/tools/security.ts` (wherever tools are intercepted).

**The Logic**:
If `agent == "coder"` AND `tool == "edit"`:
   - Check if `ERROR_LOG.md` exists.
   - Check if the agent has previously called `read("ERROR_LOG.md")` in this session.
   - If NOT: **BLOCK** the tool call.
   - **Error Message**: "BLOCKED (P114 Safety Protocol): You must read `ERROR_LOG.md` before making edits. Identify previous failures to avoid repeating them."

## Why This Works
- **Structural**: It doesn't rely on the model "remembering" to check. The *environment* forces the check.
- **Deterministic**: Code (ts) > Text (md).

## Implementation Plan
1. **Identify the intercept point**: `ToolManager.execute()` or similar.
2. **Add `P114Enforcer`**: Simple logic.
   - Check `context.agentName`.
   - Check `tool.name`.
   - specific check for `ERROR_LOG.md`.
3. **Verify**: Run a test where Coder tries to edit without reading log. Must fail with the specific error message.

Please implement this immediately. The "Growth Cycle" approach failed.
