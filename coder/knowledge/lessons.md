# Lessons

## ⛔ CRITICAL: The "Blind Overwrite" Prevention Protocol

**The #1 cause of failure is writing a file after a truncated read.**
1. **Never** use `write()` if your `read()` output contained `[... truncated]`.
2. **Never** guess what was in the missing text.
3. **Action**: If truncated, use `read(path, startLine=N, endLine=M)` to get the rest.
4. **Action**: Use `sed` for surgical edits (avoids full-file overwrite risks).
5. **Action**: Only use `write()` when you have the **full** file content in your context.

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
