# Lessons

## ⛔ CRITICAL: Blind Overwrite Prevention

**The #1 cause of failure is writing a file after a truncated read.**
1. **Rule**: If `read()` output contains `[... truncated]`, you **MUST NOT** use `write()`.
2. **Rule**: Never guess what was in the missing text.
3. **Fix**: Use `read(path, startLine=N, endLine=M)` to get the full content.
4. **Fix**: Use `sed` for surgical edits (avoids full-file overwrite risks).

## Tool Mastery

### Safe File Editing
- **Surgical**: Use `sed` for 1-5 line changes.
  - ✅ `sed -i "s/old/new/" file.ts` (Pattern matching)
  - ❌ `sed -i "15s/old/new/" file.ts` (Line numbers are fragile — DO NOT USE)
- **Full Rewrite**: Use `write` only after a complete, non-truncated read.

### Navigation
- **Relative Paths**: Always start from CWD. `src/index.ts`, not `/home/hao/...`.
- **No Guessing**: Use `ls -R src/` if unsure of structure. Don't `find /`.

## Execution Discipline
- **Run First, Then Fix**: Don't refactor code you haven't run.
- **Verify**: Always run `npx vitest --run` after changes. `tsc --noEmit` for type checks.
- **Focus**: Touch only the files requested. Scope creep = failure.
- **Error Handling**: `AgentMessage.isError` is unreliable. Check the text output.

## Task evaluation (2026-03-07 14:45:46)

- Never `write()` a file after any `read()` output marked truncated in the transcript; re-read with `read(startLine,endLine)` and then apply surgical edits (e.g., `sed`) to avoid catastrophic data loss.
- Follow the task’s requested integration approach (here: inspect on-disk eval JSON location) unless you can prove it’s impossible; if you must deviate, validate with direct evidence (file reads/greps) before refactoring interfaces/return types.
- Prefer minimal diffs: avoid full-file rewrites of existing handlers/interfaces when a small insertion suffices; it reduces risk and improves reviewability even when tests pass.
