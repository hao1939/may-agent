---
name: file-safety
description: Core protocols for reading, writing, and verifying file operations. Prevents data loss and corruption.
version: 1.1.0
tools: [read, write, edit, bash]
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

### 4. Prefer Surgical Edits Over Full Rewrites
**Small change → `edit()`. Large change → multiple `edit()` calls. Full rewrite → only for new or tiny files.**
- `write()` replaces the entire file. If your content is incomplete (context limit, copy error), the entire file is corrupted.
- `edit()` replaces only the targeted section, leaving the rest intact.
- **Rule of thumb**: If the file already exists and is > 50 lines, use `edit()` to change specific sections rather than `write()` to replace everything.
- For appending content, use `bash` with `cat >> file` or `edit()` targeting the end of the file.

## Anti-Patterns

### AP-1: "Output-Truncated Write"
**Pattern**: Agent is deep in a long session (many turns, large context). It calls `write()` with a large file payload. The model's output gets cut mid-generation — the write content ends mid-word, mid-line, or mid-JSON, producing a corrupted file that overwrites the valid original.

**Why it happens**: LLM output has a token limit. When the agent is near its context window ceiling, long write() payloads get silently truncated. The agent doesn't realize its output was cut because the truncation happens at the model output layer, not the tool layer.

**Telltale signs**:
- Content ends mid-word (e.g., `agents/sha` instead of `agents/shared/bulletin.md`)
- JSON/YAML ends without closing braces
- Markdown ends mid-sentence with no trailing newline
- File is visibly shorter than expected

**Fix**:
1. **Use `edit()` for modifications** — it only replaces the targeted text, so truncation at most damages one section
2. **For new large files**, build incrementally: write a skeleton first, then `edit()` to add sections
3. **After any write**, verify with `wc -l` and spot-check the end of the file (`tail -5 <file>`)
4. **Late in a session** (many turns elapsed), avoid writing files > 50 lines inline — use `bash` heredocs or `edit()` instead

**Evidence**: 7 occurrences across 4 agents (may, bob, tech-lead, amy-kimi). may's todo.md truncated to `agents/sha`; amy-kimi's journal.md truncated to `Tertiary*`; tech-lead overwrote agent.json files with visibly cut mid-JSON content; bob's design docs truncated after reads were already truncated.

### AP-2: "Shrink Guard Bypass via Shell"
**Pattern**: The `write()` tool's shrink guard blocks an overwrite (content < 50% of original), so the agent works around it by using `bash` with `cp`, `mv`, or redirect (`>`) to overwrite the file directly.

**Why it's dangerous**: The shrink guard exists to prevent data loss. Bypassing it defeats the safety mechanism and produces the exact corruption it was designed to prevent.

**Fix**: If the shrink guard blocks your write, it's telling you something is wrong. Either:
1. Your content is incomplete — re-read the file and include the full content
2. You should be using `edit()` instead of `write()`
3. The file legitimately needs to shrink — explain why in a comment and ensure the content is genuinely complete

**Evidence**: bob bypassed shrink guard by writing to a workspace file then `cp`-ing it over the target via `exec`.

## Inviolable Constraints

- ⛔ **Never Write After Truncated Read**: If you see `[truncated]`, stop. Narrow your read.
- ⛔ **Never Guess Paths**: Use `ls` to confirm structure.
- ⛔ **Atomic Writes**: When possible, write the full file content to ensure consistency. For large files, use surgical tools.
- ⛔ **Never bypass the shrink guard**: If `write()` blocks your overwrite, fix your content or use `edit()`. Do not use `cp`/`mv`/shell redirects to circumvent the guard.
- ⛔ **Never write large files inline late in a session**: If you've used many turns, use `edit()` or incremental writes. Long `write()` payloads risk output truncation.
