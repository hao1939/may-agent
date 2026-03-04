# Lessons

---

## ⛔ #1 Failure Pattern: Blind Overwrite After Truncated Read

**This is the single most common cause of task failure in evaluations (60% of sessions). Internalize this.**

- **NEVER use `write()` to overwrite a file after receiving a truncated read.** A truncated read means you are missing part of the file. If you write based on what you saw, you **silently destroy** everything that was truncated. This is unrecoverable data loss.
- **If a file read is truncated, you MUST use line-range reads** — `read(path, startLine=N, endLine=M)` — to see the full file in sections before making any changes. Do not proceed until you have seen every line.
- **For large files, prefer `sed` or targeted edits** over full-file `write()`. A `sed` command changes only what you specify and leaves the rest intact — it cannot destroy content you haven't seen.
- **How to detect truncation:** Look for `[... truncated]`, `[content truncated]`, or the file ending abruptly mid-line/mid-word. If the read feels incomplete, assume it is — check with `wc -l` to see the actual line count and compare to what you received.
- **The safe workflow when a read is truncated:**
  1. Note where truncation occurred (line number).
  2. Use `read(path, startLine=N, endLine=M)` to read the rest in chunks.
  3. Only after seeing the entire file, decide on your edit strategy.
  4. Prefer `sed` for surgical changes. Only use `write()` if you are confident you can reproduce the *complete* file.

---

## Paths & Navigation

- Use paths relative to the project root (your CWD). Never guess absolute paths like `/home/user/`, `/home/user/repo/`, or `/Users/jdoe/`. Run `pwd` if unsure.
- Don't prefix commands with `cd /home/hao/may-agent &&` — you're already there. Just run `npx vitest --run` directly.
- Never run `find /` or broad filesystem searches. Start with `ls src/` or `ls test/` to orient, then drill into specific directories.
- When a `grep` or `find` returns empty, don't retry with wider searches. Re-read the task to check if the file/pattern actually exists, or ask for clarification.

## Editing & Tools

- `AgentMessage.isError` is only set when a tool's `execute()` throws. Detect failures by parsing tool output text, not by checking `isError`.
- The `write` tool OVERWRITES THE ENTIRE FILE. Never use it for a one-line edit on a large file — you'll destroy the file. For surgical edits to existing files: read the full file first, apply your changes in memory, then write the complete updated file. For new files, write is fine.
- For all file editing decisions, follow the **File Editing Protocol** section below.
- Read the full file before modifying it. Don't guess at file contents based on grep snippets.
- When asked to "add X to file Y", preserve all existing content. Don't rewrite or reorganize sections you weren't asked to change. A task like "add a Review Quality section to domain.md" means append/insert that section — not rewrite the entire file and drop existing sections.

## File Editing Protocol

Choose the right strategy based on the size of your change:

### Surgical edits (one or a few lines)
- Use `sed` with **pattern matching**: `sed -i "s/exact_old_text/new_text/" file`
- **NEVER use `sed` with line numbers** (e.g., `sed -i "5s/old/new/"`, `sed -i "168s/foo/bar/"`). Line numbers shift as you make edits, causing you to corrupt the wrong lines.
- If the pattern isn't unique enough, add surrounding context: `sed -i "/surrounding_context/s/old/new/" file`

### Larger changes (multiple lines, new sections, structural rewrites)
- **Read** the full file first with the `read` tool.
- Apply your changes mentally.
- **Write** the complete updated file with the `write` tool.

### The cardinal rule
- **Before using `write` on an existing file: read it in full first.** Never write a file you have only partially read. If your earlier read was truncated, re-read the missing sections before writing. A `write` based on incomplete knowledge silently destroys the parts you didn't see.

### Banned patterns
- `sed -i "Ns/..."` (line-number addressing) — lines drift, causes corruption
- `cat > file << 'EOF'` or heredocs via exec — use the `write` tool instead
- Writing a file after only reading it with `grep` snippets or partial `head`/`tail`
- **`write()` after a truncated read** — this is the #1 cause of data loss. See the top of this file.

## Truncated Output

- When output contains `[... characters truncated]`, that content is GONE — you cannot see it. Never claim to know what was in the truncated section.
- If a file read or command output is truncated, use targeted commands (e.g., `grep -n`, `head -n`, `tail -n`, `sed -n 'Np'`) to read the specific parts you need.
- **Use line-range reads** — `read(path, startLine=N, endLine=M)` — to read remaining sections of a truncated file. This is the most reliable method.
- Do NOT fabricate counts, file names, test results, or any data from truncated output. Only report what you actually saw.
- If you need the full content of a large file, read it in sections rather than making claims about parts you didn't see.
- **A truncated read is NEVER sufficient basis for a full-file `write()`.** See the #1 Failure Pattern at the top of this file.

## Testing & Verification

- After making changes, run the full test suite (`npx vitest --run`), not just the test you think is affected. Changes often break unrelated tests.
- A test failure during development is expected — read the failure message carefully, fix the root cause, and re-run. Don't blindly retry the same command.
- Always run `npx tsc --noEmit` before running tests. Type errors cause confusing test failures.
- When tests fail, read the actual assertion error (expected vs received) — don't just re-run hoping for a different result.

## Task Execution

- Stay focused on the task you were given. Don't refactor unrelated code or explore beyond what's needed.
- If the task description includes file paths, use them directly — don't search for them.
- If you hit a wall (3+ failed attempts at the same thing), stop and report what you tried and what failed. Don't burn remaining turns on the same approach.
