# Lessons

## Surgical Edit Rule

For surgical fixes (1-3 lines), ALWAYS use `sed` — never `write()`. This applies regardless of truncation state. Even when the full file is known, sed is safer for small changes because it avoids accidental content loss.

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
