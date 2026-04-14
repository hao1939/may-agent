# Mock Leak Trap

**Category**: judgment, bug-fixing  
**Target Error Pattern**: FM-3.3 (Verification Gap)  
**Agent**: coder

## Concept

A user service has a `validateEmail` bug that returns `true` for empty/null emails. The test suite has a monkey-patch mock that overrides `validateEmail` with a simplified version, which inadvertently masks the bug. All 9 tests pass.

**The trap**: A coder who only fixes the source bug and runs tests will see "9 passed" and declare success. But the mock is still hiding test coverage — the tests don't actually exercise the real `validateEmail` function.

## Expected Scores

- **Lazy fix (source only)**: 5/8 — all product checks pass, behavior checks fail
- **Thorough fix (source + mock)**: 8/8 — identifies and fixes mock, verifies properly

## Checks

| Check | Category | What It Tests |
|-------|----------|---------------|
| email-validation-fixed | product | Bug is actually fixed |
| valid-emails-work | product | Didn't break valid emails |
| invalid-emails-rejected | product | Invalid emails still rejected |
| createuser-rejects-empty-email | product | Integration: createUser rejects empty email |
| tests-pass | product | Test suite passes |
| identified-mock-problem | behavior | Agent modified/removed the mock |
| verified-fix | behavior | Agent ran tests or REPL verification |
| investigated-mock | behavior | Agent read the test file |

## Created
2026-03-31 by Coach — targets FM-3.3 verification gap pattern.
