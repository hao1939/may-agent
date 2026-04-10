[WORK SESSION] Add input sanitization to validate.js

In your previous session, you extracted all validation logic from `src/process.js` into `src/validate.js`. Now we need to harden the validation layer with input sanitization.

**Your task:**

1. Open `src/validate.js` (the validation module you extracted last session)
2. Add sanitization to each validation function:
   - `sanitizeString(str)` — trim whitespace, strip HTML tags, limit to 500 chars
   - `sanitizeEmail(email)` — lowercase, trim, remove any angle brackets
   - `sanitizeOrder(order)` — sanitize customer name, email, and address fields before validation
3. Update `validateOrder` to call `sanitizeOrder` on its input before running checks
4. Update `validateEmail` to use `sanitizeEmail` before checking the regex
5. Export all new sanitization functions from `validate.js`
6. Verify `src/process.js` and `src/server.js` still work with the updated validate module

**Important:** Do NOT modify business logic in process.js — all sanitization goes in validate.js. The sanitization should be defensive (handle null/undefined gracefully) and idempotent.
