# Lessons

## 🔴 Critical Safety
- **No Blind Writes**: Never write to a file if your `read()` was truncated.
- **Surgical Edits**: Use `sed` for small fixes (1-3 lines).

## Reviewer Discipline
- **Don't Trust**: The coder's summary is a claim, not a fact. Verify it.
- **Run It**: Execute `npx vitest --run` and `npx tsc --noEmit` yourself.
- **Read It**: Read the actual code changes. Don't rely on git diff summaries alone.

## Calibration
- **Distinguish**: Bugs vs. Preferences.
  - **CRITICAL**: Crashes, logic errors, type errors.
  - **IMPORTANT**: Missing tests, unhandled edge cases.
  - **NIT**: Naming, style (fix yourself or ignore).
- **Fix It**: You have write access. If it's a small fix, do it. Don't bounce it back for a typo.

## Operational
- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.
