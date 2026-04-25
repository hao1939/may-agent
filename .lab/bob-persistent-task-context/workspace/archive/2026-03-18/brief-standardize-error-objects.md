# Design Brief: Common Sense Infra — Standardized Error Objects

**Status**: PROPOSED
**Owner**: Tech-Lead (Implementation)
**Architect**: Bob

## Context
Common Sense 7.3 states: "Errors are information... Report it accurately."
Currently, tools return ad-hoc error strings like "Error: File not found", "Tool execution failed: ...", or raw stack traces.
Agents use brittle regexes to parse these strings, leading to:
- **FM-2.1 (Parsing Failures)**: Agent expects "Error:" but gets "Exception:".
- **FM-2.5 (Silent Failures)**: Agent thinks "Command not found" is a valid output.
- **Wasted Ops**: Agents retry the same call because they can't distinguish "Transient Error" (network) from "Fatal Error" (file missing).

## Problem
- **Inconsistent Error Format**: Every tool fails differently.
- **Brittle Parsing**: Agents can't reliably extract error codes or context.
- **Loss of Nuance**: "Permission denied" vs "File not found" vs "Disk full" all become "It failed".

## Solution
Standardize tool outputs to a strict JSON schema for both success and failure.
Make errors **structured objects**, not just strings.

## Mechanism
1.  **Unified Return Type**: All tools return a JSON object (or stringified JSON).
    ```typescript
    interface ToolResult {
      success: boolean;
      data?: any; // The actual output
      error?: {
        code: string; // e.g., "FILE_NOT_FOUND", "EXEC_FAILED"
        message: string; // Human-readable
        context?: any; // e.g., { path: "/app/foo.txt" }
        retryable: boolean; // Hint to agent
      };
    }
    ```
2.  **Tool Wrapper**: Modify `src/lib/manager.ts` (or individual tool files) to wrap every tool execution in a try-catch that produces this structure.
3.  **Agent Logic**: Update agent prompts (via `agents/shared/common-sense.md` or system prompt) to look for this structure. "Check `result.success` first."

## Implementation Specs
1.  **Define `ToolError` class**: Extends Error, adds `code`, `retryable`.
2.  **Update `manager.runTool`**:
    -   Catch errors.
    -   If valid `ToolError`, format as JSON.
    -   If unknown error, wrap as `INTERNAL_ERROR`.
3.  **Backward Compatibility**: For now, stringify the JSON so existing text-based agents can read it.
    -   Current: `Error: File not found`
    -   New: `{"success": false, "error": {"code": "ENOENT", "message": "File not found", "retryable": false}}`

## Expected Behavior
- **Agent reads file**: `read("foo.txt")` -> `{"success": true, "data": "content..."}`
- **Agent reads missing file**: `read("missing.txt")` -> `{"success": false, "error": {"code": "ENOENT", "message": "no such file", "retryable": false}}`
- **Agent fails network**: `fetch("...")` -> `{"success": false, "error": {"code": "ETIMEOUT", "message": "Connection timed out", "retryable": true}}`

## Success Criteria
- **Zero regex parsing errors** for tool outputs.
- **Reduced Retry Loops**: Agents stop retrying fatal errors (retryable=false).
- **Clearer Error Logs**: `ops-receipts.jsonl` shows structured error codes.

## Action
- Tech-Lead to implement `ToolResult` schema and wrap tool executions in `manager.ts`.
