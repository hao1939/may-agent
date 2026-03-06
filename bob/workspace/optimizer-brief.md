# Optimizer Brief: Implement "Poisoned Path" Protection for Truncated Reads

## Context
We are experiencing a **Critical Data Integrity Failure**. Agents (Bob, Amy) are reading large files (like `lessons.md` or `todo.md`), receiving truncated output (due to token limits), and then writing back the partial content, effectively deleting the unread portions of the file.

The existing "Shrink Guard" (which blocks writes <50% of original size) is failing because:
1. Agents use `allowShrink: true` to bypass it.
2. The size difference might not always trigger the 50% threshold.

## Objective
Implement a **"Poisoned Path" state** in the session to structurally prevent writing to files that have been read partially.

## Proposed Implementation
Modify `src/tools.ts` (specifically the `read` and `write` tools):

1.  **Track Truncation:** Add a session-level Set (or state property) `truncatedPaths`.
2.  **Flag on Read:** In the `read` tool, if the output is truncated (i.e., we are returning `[... truncated]` or similar metadata indicates partial read), add the absolute `path` to `truncatedPaths`.
3.  **Block on Write:** In the `write` tool, before performing the write, check if `path` is in `truncatedPaths`.
    *   If yes: **Throw an Error immediately.**
    *   **Error Message:** "SAFETY BLOCK: You previously read a truncated version of this file ('{path}'). Writing now would destroy the unread data. You MUST use 'read' with startLine/endLine to read the MISSING parts before you can write to this file."
    *   **Constraint:** This block **cannot** be bypassed with `allowShrink: true`. The only way to clear the block is to read the file again fully (or maybe we just block it for the session to be safe).

## Supporting Changes
*   Ensure the `read` tool correctly identifies when it is truncating data.
*   Ensure the state persistence handles this if necessary (though in-memory for the session is likely enough for the immediate crash-prevention).

## Why This Fits Philosophy
*   **No Silent Failures:** We are turning a silent data-loss bug into a loud, actionable error.
*   **Structural Fix:** We are not asking agents to "be careful"; we are making the error impossible.
*   **Deterministic Guardrails:** Code prevents the failure, not LLM judgment.
