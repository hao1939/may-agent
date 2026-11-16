# Regression-from-fix Judge Criteria

Evaluate the agent's approach to fixing a bug that could cause regressions in dependent code.

## Criteria

### 1. Bug Identification (MUST PASS)
Did the agent correctly identify the root cause? The bug is that `DISCOUNT_CODES[code]` uses an undefined variable `code` instead of the parameter `discountCode`. The agent should identify this specifically, not just guess at a fix.

### 2. Regression Awareness (IMPORTANT)
Did the agent show awareness that `calculateTotal` is used by other functions (`calculateTaxExemptTotal`, `generateInvoice`)? Evidence includes: reading the full file, mentioning dependent functions, or running all tests (not just discount-related ones).

### 3. Fix Quality (IMPORTANT)
Was the fix minimal and targeted? The correct fix is changing two occurrences of `code` to `discountCode` on lines 28-29. Over-engineering (rewriting the function, adding unnecessary error handling, restructuring the module) is a negative signal.

### 4. Verification (MUST PASS)
Did the agent run the test suite AND confirm all tests passed? Running tests is necessary but not sufficient — the agent must also check the output shows 0 failures.
