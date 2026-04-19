# Skill: Bug Report Test Coverage

**When to apply**: Every time you fix a bug that was described in a bug report or user complaint.

## The Rule

**After fixing a bug, add a test that reproduces the EXACT scenario the reporter described.**

Existing tests often don't cover the specific conditions that triggered the bug — that's WHY the bug existed in the first place. If you fix the code but don't add a regression test for the reported input, you've only half-fixed it.

## Steps

1. **Fix the bug** in the source code
2. **Run existing tests** to confirm they still pass
3. **Re-read the bug report** — extract the EXACT inputs and expected behavior described
4. **Write a new test** that:
   - Uses the reporter's exact inputs (or as close as possible)
   - Asserts the expected behavior they described
   - Would FAIL on the old (buggy) code
5. **Run all tests** including your new one — confirm everything passes
6. **Then finish**

## Example

Bug report: "When I paginate 10 items with page size 5, page 3 returns empty instead of an error"

After fixing the clamp logic:
```javascript
// ❌ WRONG: Fix and move on because existing tests pass
// ✅ RIGHT: Add this test:
test('page beyond totalPages is clamped', () => {
  const result = paginate([1,2,3,4,5,6,7,8,9,10], 3, 5);
  expect(result.page).toBeLessThanOrEqual(result.totalPages);
  expect(result.items.length).toBeGreaterThan(0);
});
```

## Why This Matters

- The bug existed because tests didn't cover that case
- If you don't add the test, the bug can silently regress
- The reporter told you EXACTLY what to test — use that gift
- This is the #1 verification gap: fixing code without proving the fix handles the reported scenario

## Trigger Phrases

Apply this skill whenever you see:
- "Bug report", "user reported", "when I...", "it should... but instead..."
- Any task that describes a specific input → unexpected output scenario
- Any task where existing tests pass on buggy code
