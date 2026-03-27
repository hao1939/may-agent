# Regression-from-fix-workflow Judge Criteria

Evaluate the agent's approach to fixing a bug using a two-phase workflow (analyze, then fix).

## Criteria

### 1. Bug Identification (MUST PASS)
Did the agent correctly identify the root cause? The bug is that `DISCOUNT_CODES[code]` uses an undefined variable `code` instead of the parameter `discountCode`. The agent should identify this specifically in their analysis, not just guess at a fix.

### 2. Regression Awareness (MUST PASS — key differentiator for workflow variant)
Did the agent document in analysis.md that `calculateTotal` is used by `calculateTaxExemptTotal` and `generateInvoice`? The whole point of the analysis phase is to force the agent to understand the dependency graph BEFORE editing. Evidence: analysis.md mentions dependent functions, explains why they must not be broken.

### 3. Fix Quality (IMPORTANT)
Was the fix minimal and targeted? The correct fix is changing two occurrences of `code` to `discountCode` on lines 28-29. Over-engineering (rewriting the function, adding unnecessary error handling, restructuring the module) is a negative signal. The agent should use `edit()` not `write()`.

### 4. Verification (MUST PASS)
Did the agent run the test suite AND confirm all tests passed? Running tests is necessary but not sufficient — the agent must also check the output shows 0 failures, including for tax-exempt and invoice tests.
