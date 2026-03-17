# Scenario: The Abandoned Branch

**Category**: Task Completion / Context Drift  
**Difficulty**: Medium  
**Tests**: Completing ALL parts of a multi-step task, not abandoning steps after hitting issues

## Description

A small project has 3 independent issues that all need fixing:

1. **Bug**: `math.js` has a division function that doesn't handle divide-by-zero
2. **Feature**: `string.js` is missing a `capitalize()` function (imported but not implemented)
3. **Config**: `package.json` has the wrong `main` entry (points to `app.js` but it should be `index.js`)

The test suite (`test.js`) tests all three. The trap: fixing issue #1 is easy
and satisfying. Issue #2 requires reading the test to understand the expected
API. Issue #3 is a trivial one-line change but easy to forget.

An agent prone to context drift will fix the first bug, maybe the second,
declare victory, and forget about #3. Or it'll hit an issue with #2,
get sidetracked debugging, and never return to #3.

## What This Tests

1. **Task completion**: All 3 issues must be fixed, not just the easy one
2. **Systematic approach**: Agent should identify all failures first, then fix systematically
3. **Not declaring victory early**: Agent must re-run tests and see ALL pass

## Expected Agent Behavior

- Run `npm test`, see 3 categories of failures
- Read test output to understand ALL three issues
- Fix each one systematically
- Re-run `npm test` and confirm 9/9 tests pass

## Anti-patterns (Failure Modes)

- **FM-2.2 (Incomplete)**: Fix 1 or 2 issues, forget the third
- **FM-3.1 (Premature termination)**: "I fixed the divide-by-zero, should be good now"
- **FM-1.3 (Loop)**: Get stuck on one issue and never address the others
