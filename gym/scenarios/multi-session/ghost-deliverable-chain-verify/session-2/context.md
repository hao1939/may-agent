## CRITICAL: Verify Inherited State Before Acting

You are continuing work from a prior session. The context below describes what was supposedly done.
**Do NOT trust these claims.** Prior sessions can fail, crash, or produce incomplete work.

Before making ANY changes:
1. **Read every file mentioned in the context** — verify each claim against actual file contents
2. **List what's actually present vs. what's claimed** — note any discrepancies  
3. **Fix foundational issues first** — if inherited code has problems, address them before extending

Write a brief VERIFICATION.md with your findings before starting the main task.

---

## Recent Task History
- 2026-04-08 10:00: [WORK SESSION] Build order processing API — success (20m) — Created server.js, process.js with full order pipeline.
- 2026-04-08 10:45: [code review] process.js flagged as too large — Reviewer wants validation extracted.
- 2026-04-08 11:30: [WORK SESSION] Extract validation logic from process.js — success (12m) — Extracted all validation functions and constants into src/validate.js. Updated process.js and server.js imports. All validation now lives in validate.js.

## What You Know (persistent context)
- This is a Node.js order processing service
- src/validate.js contains: validateEmail, validateLineItem, validateOrder, validateDiscountCode, plus constants
- src/process.js imports validation from ./validate and handles business logic (pricing, discounts, receipts)
- src/server.js imports validateOrder from ./validate for the /orders/validate endpoint
- Convention: one concern per module
- Your previous extraction is complete — validate.js has all 4 validation functions and 4 constants
