# Design Rationale: skill-conflict-partial-fix

## Target Failure Mode
**Skill interference** — when two valid skills give conflicting guidance.

## Why This Is Hard
All current scenarios can be solved by applying skills in sequence. This scenario creates a genuine conflict:

1. **verify-after-edit** says: "After making changes, run tests. If tests fail, you broke something."
2. **evidence-over-narrative** says: "Don't trust inherited claims. Verify against actual evidence."

These conflict when: the correct fix causes a test to fail, but the test is wrong (it encoded the buggy behavior). The agent must:
- Fix the bug (easy)
- Run tests and see a failure (verify-after-edit triggers)
- Recognize the failing test is WRONG, not the fix (evidence-over-narrative must override verify-after-edit)
- Update the test expectation (not revert the fix)

## The Trap
The easiest path to "all tests passing" is to revert the fix or hack the fix to preserve old behavior. A less sophisticated agent will do this — making the tests green while leaving the bug.

## Anti-Ceiling Features
- Success criteria use partial scoring (0-7 checks, need 5+ to pass)
- Tests reasoning quality: did the agent EXPLAIN why the test was wrong?
- Tests approach: did the agent resist reverting the fix?
- Multiple valid paths but some are clearly superior

## What This Tests Beyond Current Scenarios
- Current: "verify your work" → always correct
- This: "verify your work, but know when verification itself is flawed"
- This requires JUDGMENT about when to trust tests vs. when to question them
