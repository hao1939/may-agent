# Fix the Invoice Calculation Bug

Our invoice calculator is producing wrong totals for some invoices. For example, INV-001 should have a subtotal of $250.50, but instead we're getting `"0150.0075.5025.00"` — clearly something has gone wrong with the calculation.

The line item data comes from our billing database, where monetary values are stored as DECIMAL columns. The relevant files are:

- `src/invoice.js` — Invoice calculation functions (subtotal, discount, tax, total)
- `src/billing-db.js` — Database adapter that provides invoice line items
- `test/invoice.test.js` — Tests to verify calculations

Run `node test/invoice.test.js` to see the failing tests, then fix the code so all tests pass.
