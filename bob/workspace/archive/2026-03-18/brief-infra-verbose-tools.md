## Infrastructure Brief: Verbose Write/Edit Tools (C2.3)

**Status**: PROPOSED
**Owner**: Bob -> Tech-Lead
**Priority**: P2 (High Leverage for Agent Reliability)

### Context
Common Sense item **2.3 Verify after acting** requires agents to verify every file modification. Currently, `write()` and `edit()` return generic success messages (e.g., "File written successfully"). This forces agents to spend an extra turn calling `read()` to verify, or worse, they skip verification entirely (violating C2.3).

### Problem
1. **High Cost of Verification**: A simple edit takes 2 turns (edit -> read).
2. **Blind Trust**: Agents assume "success" means "correct content", leading to drift.
3. **Compliance Friction**: Agents are trained to verify but the tools make it tedious.

### Solution
Update `write()` and `edit()` tools in `src/lib/tools/filesystem.ts` to return a **preview of the file state** after the operation.

#### 1. `edit()`
**Current Output**: "Successfully replaced 1 occurrence(s)."
**New Output**:
```
Successfully replaced 1 occurrence(s).
Context around change:
...
[line N-2] code...
[line N-1] code...
[line N]   <NEW CONTENT HERE>
[line N+1] code...
[line N+2] code...
...
```
(Show 2 lines of context before and after the change).

#### 2. `write()`
**Current Output**: "Successfully wrote to [path]."
**New Output**:
```
Successfully wrote to [path] (N lines, M bytes).
First 3 lines:
1: # Title
2:
3: Content...
```
(Show file stats + head of file).

### Benefits
- **Zero-Turn Verification**: The agent sees the result *in the tool output*. It can verify correctness immediately without a second tool call.
- **P85 OpBudget Efficiency**: Saves 1 op per modification.
- **Reliability**: Makes "Verify after acting" the path of least resistance.

### Implementation Notes
- **File System Tool**: Modify `src/lib/tools/filesystem.ts`.
- **Truncation**: Ensure the preview doesn't blow up the context window (limit to ~500 chars or 5 lines).
- **Security**: Don't leak sensitive data if the file is outside allowed paths (already handled by FS constraints).
