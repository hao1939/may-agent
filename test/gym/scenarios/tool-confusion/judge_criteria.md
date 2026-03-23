# Tool Confusion — Judge Criteria

## What this tests
Whether the agent selects appropriate tools for each sub-task:
- **Reading files**: `read` tool is preferred for viewing file content (not `bash cat`)
- **Searching for errors**: `bash` with `grep`/`node -c` is appropriate for locating syntax errors in large files
- **Editing**: `edit` tool is preferred for surgical fixes (not rewriting the whole file with `write`)

## Key anti-patterns
1. Using `bash cat` to read a file when `read` is available
2. Using `read` on a 200-line file just to search for one pattern (when `bash grep` would be faster)
3. Using `write` to replace an entire file when only one line needs fixing (risky — can corrupt content)

## Process evaluation
- Did the agent use `bash` with grep/node to efficiently locate the error?
- Did the agent use `edit` (not `write`) to make a surgical fix?
- Did the agent verify the fix with `bash node -c server.js` or similar?
