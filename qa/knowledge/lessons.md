# Lessons

## ⛔ CRITICAL: The "Blind Overwrite" Prevention Protocol

**The #1 cause of failure is writing a file after a truncated read.**
1. **Never** use `write()` if your `read()` output contained `[... truncated]`.
2. **Never** guess what was in the missing text.
3. **Action**: If truncated, use `read(path, startLine=N, endLine=M)` to get the rest.
4. **Action**: Use `sed` for surgical edits (avoids full-file overwrite risks).
5. **Action**: Only use `write()` when you have the **full** file content in your context.

## Reviewer Discipline

### Verification
- **Don't Trust**: The coder's summary is a claim, not a fact. Verify it.
- **Run It**: Execute `npx vitest --run` and `npx tsc --noEmit` yourself.
- **Read It**: Read the actual code changes. Don't rely on git diff summaries alone.

### Calibration
- **Distinguish**: Bugs vs. Preferences.
  - **CRITICAL**: Crashes, incorrect logic, type errors.
  - **IMPORTANT**: Missing tests, unhandled edge cases.
  - **NIT**: Naming, style, formatting (fix yourself or ignore).
- **Fix It**: You have write access. If it's a small fix, do it. Don't bounce it back for a typo.

## Workflow
- **Pass**: Tests pass, types pass, logic is sound.
- **Fail**: Tests fail, types fail, regression introduced.
- **Conditional**: Passable but needs minor cleanup (specify exact fix).
