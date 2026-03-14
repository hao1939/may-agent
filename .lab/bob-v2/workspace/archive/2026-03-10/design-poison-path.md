
## Design Poisoned Path Protection

### Goal
Prevent "Blind Overwrite" where an agent reads a truncated file and writes it back, deleting the unseen content.

### Mechanism
The `TruncationTracker` already tracks truncated reads. Currently, it only provides a *warning* (`checkWrite`) if the new content is significantly shorter. This relies on the agent reading the warning and undoing its action — which is impossible because the write has already happened.

We need a structural guardrail:
1. **Poison the Path**: When a file is read with truncation (full read > max length), mark it as "poisoned".
2. **Block Writes**: If an agent attempts to `write()` to a poisoned path, **throw an error** instead of performing the write.
3. **Safe Unpoisoning**: The only way to clear the poison is to perform a safe operation:
   - Read the full file (if small enough - unlikely if it was truncated)
   - Read using line ranges (shows intent to handle large files correctly)
   - Or just don't use `write()` — use `exec(sed)` which is safe because it edits in place.

### Implementation Plan
1. **Modify `TruncationTracker`**:
   - Add `isPoisoned(path)` check.
   - Keep `recordTruncatedRead` as the trigger.
   - The current `checkWrite` logic is a heuristic (size comparison). The new logic is strict: if it's in `truncatedReads`, you CANNOT write to it.

2. **Modify `createWriteTool`**:
   - Before writing, check `tracker.isPoisoned(path)`.
   - If true, throw a hard error:
     `Error: This file was previously read with truncation. Writing to it now would permanently delete the content you haven't seen. Use 'exec' with 'sed' for surgical edits, or read the specific line ranges you need to edit.`

3. **Modify `createReadTool`**:
   - Ensure line-range reads do NOT trigger poisoning (already correctly implemented: `tracker` is only called for full reads).
   - Ensure line-range reads do NOT clear poisoning? Actually, line-range reads confirm the agent is being careful. But they don't give the agent the *full* content to safely rewrite the file.
   - **Crucial Decision**: Does a line-range read make a full write safe?
     - No. If I read lines 1-10 of a 1000 line file, then `write()` the file with just those 10 lines, I lose 990 lines.
     - Therefore: **Line-range reads do not unpoison the path for `write()`**.
     - The ONLY way to `write()` a large file safely is to have the *full* content in context. If it's too big for context (truncated), you *cannot* use `write()`. You *must* use `exec(sed)` or `exec(echo >> ...)` or other CLI tools.

4. **Refining the Logic**:
   - `recordTruncatedRead`: sets the poison.
   - `write`: throws if poisoned.
   - `clearPath`: removes poison. When is this called?
     - Currently: when a non-truncated read happens.
     - This is correct. If the file is small enough to be read fully without truncation, it's safe to write back.

### Proposed Change to `TruncationTracker.checkWrite`
Rename to `validateWrite(path)`.
- Returns `void` or throws `Error`.
- No more "warning after the fact".

### Proposed Change to `src/tools.ts`
- Update `TruncationTracker` class.
- Update `createWriteTool` to call `validateWrite` before `writeFileSync`.
- Remove the heuristic size comparison (80%). If it was truncated, *any* write is unsafe because the agent physically doesn't have the whole file string to construct the new content.

### Verification
- Create a test file > limit.
- Read it (triggers truncation).
- Try to write it (should fail).
- Read it with line range.
- Try to write it (should still fail).
- Read a small file.
- Write it (should succeed).

This is a **structural fix** (Philosophy #14, #6).
