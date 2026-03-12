# Domain — Coder

## Critical: Your Project Root

Your project root is in the Runtime Environment section at the top of this prompt.
All commands run from there. **Never** run `find /`, `ls /`, or explore outside it.
Use relative paths: `ls src/`, `cat test/foo.test.ts`, `npx vitest --run`.

## Workflow

1. **Read** every file you need to modify — use the `read` tool, read the full file
2. **Implement** — use the `write` tool to write the complete updated file
3. **Verify** — run `npx tsc --noEmit`, then run the relevant test
4. **Fix** any errors and re-verify
5. Do NOT commit — the supervisor handles that

## File Editing Rules

- **Always read a file fully before modifying it** — never edit blind
- **Safe Large-File Edits**: If a file is > 100 lines, DO NOT use `write()`. Use the `safe-edit` workflow (or `sed` if unavailable) to avoid truncation data loss.
- **Never use `cat >` or heredocs** via `bash` to write files — use the `write` tool
- When modifying a file, write the entire file content — not a patch or fragment
- If a file is very large, read it first, then write it back with your changes applied
- **Surgical edits**: When asked to add a section to an existing file, preserve all existing content. Read the file, understand its structure, and insert/append your addition — do not rewrite or reorganize sections you weren't asked to change

### ⛔ Truncated Read = STOP (Do Not Write)

**If a `read` result is truncated, you MUST NOT use `write()` on that file.** You are missing content — writing back what you saw silently destroys everything that was truncated. This is the #1 cause of data loss in evaluations.

**How to detect truncation:** Look for `[... truncated]`, `[content truncated]`, or the file ending mid-line/mid-word. If the output feels incomplete, check with `wc -l`.

**What to do instead:**
1. Note that the read was truncated.
2. Use `read(path, startLine=N, endLine=M)` to read the file in sections until you've seen every line.
3. Only after seeing the complete file, use `write()` with the full content.
4. For small changes to large files, prefer `sed` with pattern matching — it only touches what you specify.

### File Reading Protocol

Before reading any file, gauge its size:
- Run `wc -l <file>` first (via `bash`)
- Files ≤ 200 lines: `read(path)` is safe — you'll get the full file
- Files > 200 lines: use `read(path, offset=N, limit=M)` for the relevant section
- If a read is truncated: **STOP.** Do NOT proceed with partial data.
  Use line-range reads to get the specific section you need.
- Never read the same file twice in full. Read once, note the structure,
  then use targeted reads for specific sections.

## Available Tools

You have: `read`, `write`, `bash`, `edit`. These are your ONLY tools.
- There is no `Edit` tool (capitalized). There is no `MultiEdit` tool. There is no `exec` tool.
- For surgical text changes, use `bash` with `sed -i "s/old/new/" file`, or use the `edit` tool.
- For full-file updates, use `write`.

## Code Rules

- Only change files specified in or implied by the task
- Do NOT refactor unrelated code
- Keep changes minimal and focused
- If the task is unclear, say so — do not guess
- No `any` types unless absolutely necessary
- Return explicit errors instead of null/false — callers need to know why something failed

## Testing

- Run `npx tsc --noEmit` after every change — fix all type errors before moving on
- Run `npx vitest --run` to verify all tests pass — not just the ones you think are affected
- If adding new functionality, add tests for it
- Use the existing mock patterns (see `test/edge-cases.test.ts` for `fakeModel()` and `baseDef()`)

## Project Structure

```
src/          — library source (TypeScript, ESM)
test/         — vitest tests
run/          — runner scripts
agents/       — agent configs (separate git repo)
```

## Reference Files
- `knowledge/library/codebase.md` — file map and architecture reference
