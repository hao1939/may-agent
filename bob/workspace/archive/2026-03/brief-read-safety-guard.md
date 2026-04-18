# Brief: Read Safety Guard (FM-2.1 / FM-3.1 Mitigation)

**Context**: 
Agents frequently misuse the `read` tool, leading to:
1.  **Context Overflow**: Reading massive files (e.g., `package-lock.json`, `pnpm-lock.yaml`) entirely, wasting tokens and budget.
2.  **Directory Confusion**: Trying to `read("src/")` and getting garbage or errors, instead of using `ls`.
3.  **Binary Noise**: Reading images or binaries, polluting context.

**Strategy**: 
Shift from "Soft Prompt" (telling agents "don't read big files") to "Hard Constraint" (Runtime Guard).

**Implementation Requirements**:
Modify `src/lib/tools/fs.ts` (or the tool wrapper in `manager.ts`) to enforce:

1.  **Directory Block**: 
    - If `path` is a directory, throw Error: `"Path is a directory. Use 'bash ls -F' to list contents."`
    
2.  **Size Cap (The "50KB Rule")**:
    - If file size > 50KB AND `limit` is NOT provided:
        - Throw Error: `"File is too large (${size} bytes). Use 'read' with 'offset' and 'limit' to read in chunks, or 'grep' to search."`
    - *Exception*: Allow if `force: true` (if we add that flag) or if the agent explicitly requested a range. But for now, just block full reads of huge files.

3.  **Binary Guard (Optional but Good)**:
    - Check for binary content (null bytes) in the first 512 bytes.
    - If binary, throw Error: `"File appears to be binary. Cannot read text."`

**Expected Outcome**:
- **Immediate Failure** when an agent tries to `read("pnpm-lock.yaml")`.
- Agent catches the error and is forced to use `grep` or `read` with limits (learning the hard constraint).
- **Zero** accidental context bombs.

**Verification**:
1.  Create a 60KB dummy file.
2.  Try `read(dummy)`. Expect Error.
3.  Try `read(dummy, { limit: 100 })`. Expect Success.
4.  Try `read(directory)`. Expect Error.
