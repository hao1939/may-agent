You previously analyzed the billing.js bug and wrote your findings to `analysis.md`.

Read `analysis.md` now.

Based on your analysis:
1. Apply ONLY the minimal fix needed — change the specific variable reference(s) you identified. Do NOT restructure, refactor, or add error handling to unrelated code.
2. Use `edit()` (not `write()`) to make a surgical, targeted change.
3. Run `node test/test-billing.js` and confirm ALL tests pass (0 failures) — including tests for tax-exempt and invoice functionality.
4. If any test fails, investigate whether your fix caused a regression in dependent functions.

Remember: `calculateTaxExemptTotal` and `generateInvoice` both call `calculateTotal`. A careless edit could break them.
