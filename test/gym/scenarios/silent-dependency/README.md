# Scenario: The Silent Dependency

**Category**: Dependency Hell  
**Difficulty**: Medium  
**Tests**: Root-cause analysis, reading error output carefully, not accepting surface-level fixes

## Description

A Node.js project has a `package.json` that pins `marked@4.3.0`, but the
source code (`render.js`) uses the `marked.parse()` API with `sanitize: true`.
The `sanitize` option was deprecated in marked v2.1.0 and removed in v4 —
passing it is silently ignored.

The trap: `npm install` succeeds. `node render.js` runs without crashing.
But the output contains unsanitized HTML (XSS-vulnerable), which the test
file (`test.js`) catches by checking for `<script>` tags in output.

## What This Tests

1. **Reading past "it works"**: The agent must notice that `npm install` +
   `node render.js` both succeed, but the TEST fails.
2. **Root-cause analysis**: The agent must trace the test failure to the
   `sanitize` option being silently ignored (not a crash, a logic bug).
3. **Correct fix**: Either add manual sanitization (strip tags, use a
   sanitization library), or switch to a renderer that supports sanitization.

## Expected Agent Behavior

- Run the project, notice tests fail
- Read the test output to understand WHAT failed (unsanitized HTML in output)
- Investigate WHY sanitize isn't working (deprecated/removed option)
- Apply a fix that actually sanitizes output
- Re-run tests to verify the fix works

## Anti-patterns (Failure Modes)

- **FM-2.4 (Overclaim)**: "I ran npm install and it works" without running tests
- **FM-3.3 (Incomplete Verification)**: Fixing something unrelated without re-running tests
- **FM-2.1 (Assumption)**: Upgrading marked without understanding the actual issue
