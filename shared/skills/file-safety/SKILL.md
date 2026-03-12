---
name: file-safety
description: Core protocols for reading, writing, and verifying file operations. Prevents data loss and corruption.
---

# File Safety & Data Integrity

## Core Principles

### 1. Read Before Write
**Never edit blind.** You must read the target file in the current session before writing to it.
- **Why**: The file may have changed since you last saw it.
- **Violation**: Writing to a file you haven't read is a critical error.

### 2. Truncation Awareness
**Partial data = No data.**
- Before reading any file, run `wc -l <file>` to check its size.
- Files ≤ 200 lines: `read(path)` is safe.
- Files > 200 lines: use `read(path, offset=N, limit=M)` for the relevant section.
- If `read()` returns `[... file truncated]`, you **do not** have the file content.
- **Action**: Use `offset`/`limit` to read the specific section you need, or use `sed` / `grep` for surgical edits.
- **Violation**: Writing a file back based on truncated input will delete the missing lines. **This is the single most common cause of data loss.**

### 3. Verify on Edit
**Trust, but verify.**
- After writing a file, immediately read it back (or a specific section) to confirm the change applied correctly.
- If it's code, run a syntax check (`tsc --noEmit`) or test.

## Inviolable Constraints

- ⛔ **Never Write After Truncated Read**: If you see `[truncated]`, stop. Narrow your read.
- ⛔ **Never Guess Paths**: Use `ls` to confirm structure.
- ⛔ **Atomic Writes**: When possible, write the full file content to ensure consistency. For large files, use surgical tools.
