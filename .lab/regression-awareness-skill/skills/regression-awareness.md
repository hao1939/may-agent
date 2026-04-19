# Skill: Regression Awareness

**Purpose**: When fixing a bug, check what other code depends on the function you're changing. Run ALL tests after the fix — not just the one related to the reported bug. A fix that solves one problem but breaks two others is worse than no fix.

## The Rule

**Before editing any function, grep for all callers. After editing, run the FULL test suite.**

## How to Apply

### Step 1: Before editing, map the blast radius
```
# Find who calls the function you're about to change
bash({ command: "grep -rn 'calculateTotal' src/" })
→ src/billing.js:24: function calculateTotal(subtotal, discountCode)
→ src/billing.js:47: const result = calculateTotal(subtotal, discountCode);
→ src/billing.js:62: const totals = calculateTotal(subtotal, discountCode);
→ 3 references: the function itself + 2 callers (calculateTaxExemptTotal, generateInvoice)
```
Now you know: your fix must NOT change the function's interface or return shape.

### Step 2: Make a minimal, targeted fix
Use `edit()` to change ONLY the buggy lines. Do not rewrite the whole function. Do not refactor neighboring code. Do not "improve" things that aren't broken.

### Step 3: Run ALL tests, not just the bug-related one
```
# Even if the task says "run test-billing.js", run ALL tests:
bash({ command: "node test/test-billing.js" })
→ Check that EVERY test passes, including tests for dependent functions
→ "0 failed" or no ✗ markers means safe
```

### Step 4: Confirm dependent functions still work
If the test output doesn't clearly cover dependent functions, verify manually:
```
bash({ command: "node -e \"const b = require('./src/billing.js'); console.log(b.calculateTaxExemptTotal(100, 'SAVE20'))\"" })
→ Verify the dependent function returns correct values with the fix applied
```

## Examples

### ❌ BAD: Fix the bug, skip checking side-effects
```
# Read the bug report → find the typo → fix it → only check discount tests
edit({ path: "src/billing.js", ... })  // fix applied
bash({ command: "node -e \"...test discount only...\"" })
→ "Discount works!" → finish(success)
```
This is dangerous — you never checked if tax-exempt or invoice generation still works.

### ✅ GOOD: Map callers, make minimal fix, run full tests
```
# 1. Read the file
read({ path: "src/billing.js" })
→ See calculateTotal, calculateTaxExemptTotal, generateInvoice

# 2. Grep for callers
bash({ command: "grep -rn 'calculateTotal' src/" })
→ 2 callers found — fix must preserve interface

# 3. Make minimal fix
edit({ path: "src/billing.js", oldText: "DISCOUNT_CODES[code]", newText: "DISCOUNT_CODES[discountCode]" })

# 4. Run ALL tests
bash({ command: "node test/test-billing.js" })
→ "All 8 tests passed, 0 failed"
→ Confirmed: discount fixed AND no regressions in tax-exempt or invoices
```

## Why This Matters

- **Silent regressions**: A function may be called in 5 places. Fixing the bug in place 1 while breaking places 2-5 is a net negative.
- **Interface contracts**: If `calculateTotal` returns `{ subtotal, discount, taxable, tax, total }`, dependent functions rely on ALL those fields. Changing the shape breaks callers.
- **Test coverage gap**: Bug reports usually point to ONE symptom. The test suite covers MORE. Always run the full suite.
- **Production impact**: A regression shipped to production causes more damage than the original bug, because users have adapted their workflow around the original behavior.
