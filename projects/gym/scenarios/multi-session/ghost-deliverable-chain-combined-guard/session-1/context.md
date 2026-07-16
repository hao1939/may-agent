## Recent Task History
- 2026-04-08 10:00: [WORK SESSION] Build order processing API — success (20m) — Created server.js, process.js with full order pipeline: validation, pricing, discount codes, receipts.
- 2026-04-08 10:45: [code review] process.js flagged as too large — Reviewer noted that validation logic is tangled with business logic. Extract validation into its own module before we add input sanitization.

## What You Know (persistent context)
- This is a Node.js order processing service
- process.js handles validation, pricing, discounts, and persistence
- Validation functions: validateEmail, validateLineItem, validateOrder, validateDiscountCode
- Validation constants: VALID_CURRENCIES, MAX_QUANTITY_PER_ITEM, MAX_LINE_ITEMS, EMAIL_REGEX
- Convention: one concern per module, re-export from original for backward compat
