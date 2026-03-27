# Workflow Proposal: Safe File Edit

## Problem
Agents frequently cause data loss by reading a large file, receiving a truncated result (e.g., `[... truncated]`), and then writing the truncated content back to the file. This "blind overwrite" is a critical failure mode (observed in `s_1772894556976_13`).

## Pattern
The dangerous sequence is:
1. `read(file)` -> returns partial content
2. Agent modifies the partial content in memory
3. `write(file, content)` -> overwrites original with partial content

## Proposed Workflow: `safe-edit`
A workflow that enforces file size checks and surgical editing for large files.

### Steps
1. **Size Check**: Run `wc -l <file>` to determine line count.
2. **Strategy Selection**:
   - **Small File (< 300 lines)**:
     - `read(file)` (full)
     - Apply changes
     - `write(file)`
   - **Large File (>= 300 lines)**:
     - **Locate**: `grep -n "context" <file>` to find line numbers.
     - **Read Context**: `read(file, startLine, endLine)` to confirm context.
     - **Apply**: Use `sed` or `perl` for surgical replacement.
     - **Verify**: `read(file, startLine, endLine)` to confirm the change took effect.

### Benefits
- **Eliminates Truncation Risk**: Never rewrites the full file based on a partial read.
- **Enforces Verification**: "Verify-on-Edit" (P19) is built into the workflow.
- **Reduces Token Usage**: Reading only relevant sections saves tokens on large files.

### Status
- **Identified**: 2026-03-07 (Bob)
- **Source**: `s_1772894556976_13` (Coder overwriting `run/handler-context.ts`)
- **Action**: Optimizer to implement `agents/optimizer/workflows/safe-edit.ts`
