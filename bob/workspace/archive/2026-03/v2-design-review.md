# Design Review: V2 Architecture (Growth System) — Final

## Verdict: Aligned & Recommended ✅

**Status:** The design is now fully comprehensive. Recent updates have filled the remaining gaps regarding **Workflow Resilience** and **Tool Interfaces**. The system definition is ready for implementation.

## Review of Latest Updates

### 1. Workflow Resilience (New & Critical ✅)
*   **Change:** Added specific design for **Workflow Step Persistence** (`.state/workflows/<runId>.json`).
*   **Mechanism:** `ctx.callAgent` automatically checkpoints results. On restart, completed steps return cached results; execution resumes from the first missing step.
*   **Verdict:** **Excellent.** This addresses the "Crash Recovery" requirement for long-running multi-step processes (like "Implement Feature X") without requiring complex logic in the agent code. It makes workflows durable by default.

### 2. Tooling Specification (Clarified)
*   **Change:** Explicit definition of the `agents` tool (replacing `subagents`).
*   **Actions:** `call`, `list`, `cancel`, `peek`, `steer`.
*   **Verdict:** Aligned. Consolidating 11 actions into 5 clean primitives reduces cognitive load on the model.

### 3. Persistence Layout (Defined)
*   **Change:** detailed `.state/` directory structure.
    *   `memory/` (JSONL summaries)
    *   `sessions/` (Logs & Output)
    *   `workflows/` (Step checkpoints)
*   **Verdict:** Clear and standard.

### 4. UI Command Handling (Confirmed)
*   **Change:** Explicit list of **"Built-in commands (no LLM)"** (`status`, `cancel`, `reload`).
*   **Impact:** Confirms my previous deduction that the Chat Loop handles operational concerns directly, preventing the "Blocked Interface" problem.

## Final Implementation Checklist for Tech Lead

With the design frozen, the implementation plan must cover:

1.  **The Migration Script:** `v1-to-v2.ts` to move `memory.md` -> `.state/memory/*.jsonl`.
2.  **The Chat Loop:** A solid `readline` or `socket` loop that parses `status`/`cancel` *before* hitting the LLM.
3.  **The Sentinel:** Ensure `[STARTED]` files are cleaned up or reconciled on boot (as per the "Crash Recovery" section).
4.  **Workflow Engine:** Implementing the `ctx.callAgent` wrapper that handles the JSON checkpointing.

## Conclusion
This document (`docs/v2-design.md`) is now a complete blueprint. No further design cycles are needed. **Approved for build.**
