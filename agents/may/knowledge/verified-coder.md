# Verified Coder Workflow

The `verified-coder` workflow is a **hard-gated** implementation loop.
It will **not return** until the code passes the provided verification command.

## When to use
- Critical bug fixes where "it compiles" isn't enough.
- Refactoring core logic where regression is fatal.
- When you have a clear test command (e.g., `npm test`, `tsc`, `node test.js`).

## How to use
From `workflow` tool:
```javascript
workflow.run({
  name: "verified-coder",
  task: "Fix the race condition in session manager.\n\nverifyCommand: npm test test/session-race.test.ts"
})
```

## Structure
1. **Tech Lead** analyzes the problem and plans the fix.
2. **Coder** implements the fix.
3. **System** runs the `verifyCommand`.
   - **PASS**: Workflow completes successfully.
   - **FAIL**: Output is fed back to Coder for retry (up to 5 attempts).

## Why this is better than `implement-and-review`
- `implement-and-review` relies on QA's *opinion* and static analysis.
- `verified-coder` relies on *execution reality*.
- Use `verified-coder` when you have a test. Use `implement-and-review` for new features or UI work where automated tests might not exist yet.
