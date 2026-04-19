# Skill: Root Cause Diagnosis

**Purpose**: When debugging, trace the actual error path from symptoms to root cause before editing anything. Resist the urge to fix the first suspicious thing you see — misleading warnings and red herrings are common.

## The Protocol

### Step 1: Reproduce the failure
- Run the tests or reproduce the reported bug
- Read the **actual test assertions** that fail — what value was expected vs. what was produced?
- Ignore warnings/logs that aren't directly related to the failing assertion

### Step 2: Trace backwards from the failure
- Start from the failing test assertion (e.g., "expected 29.97, got 29")
- Trace the computation path: which function produced the wrong value?
- Read that function's code carefully — find where the number goes wrong
- Follow the data flow: input → transformation → output

### Step 3: Distinguish root cause from red herrings
- **Root cause**: The code path that directly produces the wrong output value
- **Red herring**: Warnings, logs, or suspicious-looking code that does NOT affect the failing test
- Ask: "If I fix this suspicious thing, will the failing assertion now pass?" If the answer isn't clearly YES, keep tracing.

### Step 4: Fix only the root cause
- Edit the specific line(s) that cause the wrong output
- Do NOT fix warnings or style issues that don't affect test outcomes
- Run tests again to confirm the fix works

## Anti-patterns to Avoid

### ❌ BAD: Fix the first warning you see
```
Console says "Invalid discount format"
→ Fix the discount validator
→ Tests still fail because the real bug was in price rounding
```

### ✅ GOOD: Trace from the assertion
```
Test says: expected 29.97, got 29
→ Where is 29.97 computed? In calculateTotal()
→ calculateTotal uses Math.trunc() instead of proper rounding
→ Fix Math.trunc → proper rounding
→ Tests pass. The "Invalid discount format" warning was irrelevant.
```

## Key Principle

**The failing test tells you exactly what's wrong. Trust the test output over log warnings.** Trace the math/logic from expected→actual, and you'll find the bug.
