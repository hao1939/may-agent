# Skill: Verify Before Finish

**When to apply**: Before calling `finish()` on ANY task.

## The Rule

After completing your primary fix/implementation, **stop and ask**:
1. Did I verify the fix works? (run tests, read output)
2. Did I check for edge cases the existing tests might miss?
3. Should I add a test for the specific edge case I fixed?

## Concrete Steps

1. **Fix the bug** as specified in the task
2. **Run existing tests** — confirm they pass
3. **Think about edge cases**: What inputs would trigger the bug I just fixed? Are those inputs covered by existing tests?
4. **If edge cases are NOT tested**: Write a small test that covers the exact boundary condition you fixed
5. **Run tests again** — confirm your new test passes too
6. **Only then** call `finish()`

## Why This Matters

Fixing a bug without adding a test for the triggering condition means:
- The bug could regress silently
- You haven't proven you understand WHY the bug occurred
- Your fix might be incomplete (works for one case but not another)

## Anti-pattern

❌ Fix bug → run tests → all pass → finish
✅ Fix bug → run tests → all pass → add edge case test → run tests → all pass → finish
