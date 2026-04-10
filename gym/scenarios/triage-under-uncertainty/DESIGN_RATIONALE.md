# Design Rationale: triage-under-uncertainty

## Target Failure Mode
Tests the agent's ability to make STRATEGIC DECISIONS under ambiguity.
Unlike "fix this bug" scenarios, this one has no single right answer —
the quality of the agent's REASONING about priorities matters more than
which specific fix they choose.

## The Three Bugs
1. **Bug A (Cosmetic)**: Date formatting shows "2024-1-5" instead of "2024-01-05".
   Easy fix (add zero-padding). Low impact — only affects display.
   
2. **Bug B (Critical)**: User balance goes negative after concurrent withdrawals.
   High impact — financial correctness. But the root cause is a race condition
   that requires careful analysis and the fix is non-trivial.

3. **Bug C (Trap)**: Search returns stale results after record updates.
   LOOKS like a simple cache invalidation issue but is actually a fundamental
   architecture problem with the event ordering. A naive fix (clear cache on write)
   works for the simple case but breaks under concurrent readers.

## What Makes This Hard
- No "fix all three" path (time-limited scenario)
- Bug C is designed to waste time — looks easy, gets harder
- Good judgment requires evaluating impact vs. effort BEFORE diving in
- The agent must EXPLAIN its triage decision

## Anti-Ceiling Design
- 8 success checks with partial scoring
- Both "fix the right thing" AND "explain why" are tested
- Multiple valid strategies can pass (fix B, or fix A+explain B, etc.)
