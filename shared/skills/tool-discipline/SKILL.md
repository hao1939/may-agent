---
name: tool-discipline
description: Pre-flight and post-flight checklists for every tool call. Prevents FM-2.1 TOOL_SCHEMA_ERROR — the #1 failure mode — by catching mistakes before they happen.
version: 1.0.0
owner: optimizer
---

# Tool Discipline: Read-Check-Act-Verify

## When to Apply

Apply this skill on **every tool call** you make. It's not a separate task —
it's a mental checklist you run inline, like a pilot's pre-flight check.
The cost is a few seconds of thought per call. The payoff: avoiding the
wasted turns, cascading failures, and dead-end sessions that tool errors cause.

Specific triggers where this skill is critical:
- Before any `edit()` — the highest-risk tool call (80% failure rate without prior read)
- After any `bash()` — exit codes are frequently misread or ignored
- When you're deep in a session (many turns used) — this is when empty/truncated tool calls spike
- After any tool returns an error — the recovery path matters more than the initial failure

## Why This Matters

FM-2.1 TOOL_SCHEMA_ERROR is the most frequent failure mode across all agents
(39 occurrences in recent evaluations). The root causes are preventable:

- **Empty arguments** (`bash({})`, `finish({})`) — 41 occurrences. Agents near
  context limits emit tool calls with missing required fields.
- **Edit without read** — 80% failure rate when editing a file you haven't read
  in the current session, vs 3% when you read first.
- **Ignored exit codes** — `diff` returning exit 1 was misread as "Clean" (3 occurrences).
  `git` errors (exit 128) and `ls` errors (exit 2) were silently skipped.

These aren't edge cases. They're the #1 way agents waste turns and produce
incomplete sessions.

## Steps

### Step 1: PRE-READ (before edit or write)

Before calling `edit()` or `write()` on an existing file, read it first.

1. Call `read(path)` on the target file (or the relevant section if it's large).
2. Copy the exact text you want to replace from the read output — don't type it from memory.
3. Only then construct your `edit()` call using the copied text as `oldText`.

**Why**: The edit tool requires an exact character-for-character match. Files change
between sessions, and your memory of the file content drifts from reality. Reading
first gives you the ground truth. Without it, you're guessing — and the data shows
you'll guess wrong 80% of the time.

### Step 2: ARG-CHECK (before every tool call)

Before submitting any tool call, mentally verify the required parameters are present:

| Tool | Required fields | Common mistake |
|------|----------------|----------------|
| `bash` | `command` (non-empty string) | Sending `bash({})` with no command field |
| `edit` | `path`, `oldText`, `newText` | Missing `path` entirely; empty `oldText` |
| `read` | `path` | Sending `read({})` with no path |
| `write` | `path`, `content` | Truncated content when context is tight |
| `finish` | `status`, `summary` | Sending `finish({})` with no fields |

**When you're running low on context** (many turns into a session, long conversation),
this is when empty-argument errors spike. The model's output gets compressed and fields
get dropped. Counteract this by keeping tool calls simple and short:
- Use shorter `command` strings in `bash`
- Make smaller, targeted `edit()` calls instead of large rewrites
- Summarize rather than quote entire files in arguments

### Step 3: OUTPUT-CHECK (after every tool call)

After a tool returns, read its output before proceeding. Specifically:

1. **Check for error messages**: "Could not find exact text", "ENOENT", "Command exited with code N".
2. **Check exit codes from bash**: Exit 0 means success. Exit 1 often means logical failure
   (e.g., `diff` found differences, `grep` found no matches). Exit 2+ means an error occurred.
   Don't assume a bash call succeeded just because it returned output.
3. **Check for ENOENT / "No such file"**: If a `read()` or `bash` returns file-not-found,
   don't proceed as if you have the file content. Run `find` or `ls` to discover the correct path.
4. **Check for truncation**: If `read()` says `[N more lines in file]`, you don't have the full
   content. Use `offset`/`limit` to get the section you need, or use `grep` for targeted search.

**Why**: Tool output contains critical information that agents routinely ignore.
Three of three `read()` ENOENT errors in recent sessions were not handled — agents
tried to use content from files that didn't exist. Multiple `diff` exit-code-1 results
were misread as "clean" (no differences). Checking output is free; ignoring it costs
entire sessions.

### Step 4: POST-VERIFY (after edit or write)

After modifying a file, confirm the change actually applied:

1. `read(path)` the modified section, or `bash("tail -5 <path>")` for a quick check.
2. Verify the new content is present and the surrounding content wasn't damaged.
3. For code changes, run a syntax check if available (`tsc --noEmit`, `node -c`, etc.).

**Why**: Tool output confirmations can be misleading — the only reliable way to confirm
a change is to read the file back. Currently only 22% of edits and 12.5% of writes are
followed by a verification read. The other 78-88% are trusting tool output alone.

## Assertions

1. When the agent calls `edit()`, it has called `read()` on the same file path earlier in the session (before the edit).
2. Every `bash()` call includes a non-empty `command` parameter; every `edit()` call includes `path`, `oldText`, and `newText`; every `finish()` call includes `status` and `summary`.
3. When `bash()` returns a non-zero exit code, the agent's next action acknowledges the error (mentions it in reasoning, retries with a fix, or reports the failure) — it does not silently proceed as if the command succeeded.
4. When `read()` returns ENOENT or "No such file", the agent does not use fabricated content from that file — it discovers the correct path or reports the file as missing.
5. After at least one `edit()` or `write()` call in the session, the agent reads back the modified file to verify the change.

## Anti-Patterns

### AP-1: Blind Edit (edit without reading first)
The agent calls `edit()` on a file it hasn't read in the current session. The `oldText`
is typed from memory or copied from a previous session. It doesn't match the actual file
content, and the edit fails with "Could not find exact text."

**Recovery when this happens**: Read the file immediately, find the actual text, construct
a new edit with the exact text from the read output. Don't retry the same `oldText` — it
failed because it doesn't match reality.

**Evidence**: 4 EDIT_EXACT_MATCH_FAIL occurrences. Recovery analysis shows only 1 of 4
agents read the file after the first failure; the other 3 retried blindly or gave up.

### AP-2: Ghost Exit Code (ignoring bash exit codes)
The agent runs a `bash()` command, gets output with a non-zero exit code, and continues
as if the command succeeded. Common with `diff` (exit 1 = differences found, misread as
"clean"), `git` (exit 128 = fatal error, skipped), and `grep` (exit 1 = no matches,
treated as if matches were found).

**Evidence**: 3 occurrences of `diff` exit 1 misread as "Clean"; `git` exit 128 and
`ls` exit 2 errors silently skipped in tech-lead sessions.

### AP-3: Context-Limit Collapse (empty tool calls when context is full)
Deep into a session, the agent starts emitting tool calls with missing or empty parameters:
`bash({})`, `finish({})`, `read({})`. This is a model output degradation problem — the
context window is nearly full, and the model's generation gets compressed or truncated.

**When you notice this happening** (a validation error on a tool call): slow down. Simplify
your next tool call. Use shorter arguments. If you're near the end of your work, call
`finish()` with a brief summary rather than trying to squeeze in more complex operations.

### AP-4: Bash-as-Cat (reading files via bash instead of read)
The agent uses `bash({ command: "cat file.md" })` to read file contents instead of the
native `read({ path: "file.md" })` tool. Worse: some agents use `bash({ command: "read file.md" })`
which invokes the bash builtin `read` (waits for stdin), always fails, then retry with `cat`.

**Why this wastes money**: `bash("cat file.md")` returns raw file content without pagination,
potentially flooding the context with 50-100KB of text. The `read()` tool has built-in
pagination (offset/limit) and truncation (2000 lines / 50KB cap). Each unnecessary bash
call also adds a full LLM round-trip (~$0.05-0.10).

**Scale**: 61 bash-as-cat calls in 6 hours system-wide. Bob (gemini-3-pro-preview) = 19 calls
including 10 double-reads (`bash("read")` → `bash("cat")`). Coach = 14 calls. ~$20-30/day waste.

**Fix**: Always use `read({ path: "..." })` to read file contents. Reserve `bash` for:
- Running commands (`npm test`, `tsc --noEmit`, `git status`)
- Searching (`grep`, `find`, `rg`)
- File manipulation (`mv`, `cp`, `mkdir`)
- Piped operations (`cat file | grep pattern`, `wc -l`)

**Evidence**: Cost scan 2026-03-22T07:39. Bob session s_1774163223624_405 ($5.26, 19 bash-as-cat).
Coach session s_1774163513216_408 (6 bash-as-cat).

## Programmatic Guards

The `agents/shared/agent-sdk.js` exports three guard modules that automate
violation prevention. **Use them in handlers and workflows:**

### EditGuard (edit-guard)
```typescript
import { EditGuard } from "../../shared/agent-sdk.js";
const guard = new EditGuard();
guard.recordRead("file.ts");          // call after every read()
const result = guard.validateEdit("file.ts"); // call before every edit()
if (!result.valid) { /* abort — file wasn't read first */ }
```

### validateBashCommand (path-guard)
```typescript
import { validateBashCommand } from "../../shared/agent-sdk.js";
const result = validateBashCommand("cat /home/user/.bashrc");
if (!result.valid) { /* abort — uses forbidden /home/ path */ }
```

### enforceNoHallucinatedPaths (path-guard)
```typescript
import { enforceNoHallucinatedPaths } from "../../shared/agent-sdk.js";
const result = enforceNoHallucinatedPaths(["/home/agent/file.txt"]);
if (!result.valid) { /* abort — hallucinated absolute path */ }
```

These guards are invoked automatically by `compliance-check.ts` every 30 minutes
as smoke tests. Integrate them into your own handlers for real-time prevention.
