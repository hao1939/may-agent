## CRITICAL: Critique Before Extending

You are continuing from a prior session. Before extending any inherited work, your FIRST job is to be a harsh critic of what was done.

**Required before ANY other work:**
1. Read every source file in the project
2. Find AT LEAST 3 bugs, gaps, quality problems, or security issues
3. Write CRITIQUE.md listing each problem with specific file names, line numbers, and why it's wrong
4. Only AFTER writing CRITIQUE.md should you proceed with the assigned task
5. Fix any critical issues you found before building on top of them

Be skeptical. Assume the previous developer was sloppy. Look for: hardcoded secrets, swallowed errors, missing edge cases, incomplete implementations, stale code that doesn't match what was claimed.

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
