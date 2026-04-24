## Design Brief: Smart Edit Tool
**Status**: Proposal
**Owner**: Bob (Design) / Tech-Lead (Implementation)
**Related**: Common Sense 2.3 (Verify after acting), 7.2 (Don't fabricate)

### 1. Problem
Agents frequently break files they edit.
- **Blind Edits**: They replace text without checking context, causing "search string not found" errors.
- **Lossy Edits**: `write()` replaces the entire file, deleting 1000 lines when they meant to append.
- **Unverified Edits**: They edit and assume success, without reading back to check if they broke syntax.

**Root Cause**: The current `edit()` tool is too primitive. It puts the burden of verification entirely on the agent (who often forgets).

### 2. Solution: `smart_edit`
A wrapper around file operations that enforces safety and verification *at the infrastructure level*.

**Signature**:
```typescript
smart_edit(
  path: string,
  operations: Array<{
    type: "replace" | "append" | "insert_after",
    search?: string, // for replace/insert
    content: string
  }>,
  dry_run?: boolean // return diff without applying
): {
  success: boolean,
  diff: string, // Unified diff of changes
  preview: string // Context around the change (N lines)
}
```

### 3. Key Mechanisms
1. **Atomic Verification**: The tool performs the edit in memory, checks if the `search` string is unique (preventing ambiguity), and validates the result *before* writing to disk.
2. **Context Return**: Instead of just "Done", it returns a preview of the modified area. This forces the agent to "see" the result.
3. **Safety Gates**:
   - Rejects if `search` string matches 0 or >1 times (ambiguity).
   - Rejects if file size shrinks by >50% (accidental deletion protection).
   - Backs up original file to `.bak` before writing.

### 4. Implementation Plan
1. **Tech-Lead**: Implement `src/lib/tools/smart-edit.ts`.
2. **Tech-Lead**: Expose as `edit` tool (replacing current primitive `edit` or enhancing it).
3. **Coach**: Update `agents/shared/common-sense.md` to reflect the new capability (Infrastructure owns verification).

### 5. Success Metric
- Reduction in "ENOENT" or "content mismatch" errors in edit operations.
- Zero incidents of accidental file truncation.
