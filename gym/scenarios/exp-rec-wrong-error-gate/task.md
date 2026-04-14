## Phase 1: Investigate the Codebase — Do NOT Fix Yet

Our user validation module is rejecting valid email addresses. Users with `+` tags in their emails (like `user+tag@example.com`) are getting rejected during registration.

Before fixing anything, investigate ALL source files thoroughly.

Read these files completely:
- `src/validator.js` — the validation module
- `src/user-service.js` — the registration service that uses the validator
- `test/validator.test.js` — the test suite

Run the tests with `node test/validator.test.js` to see what fails and why.

REQUIRED DELIVERABLE: Create `REVIEW.md` in the project root listing EVERY issue you find:

1. **The obvious test failure** — describe exactly what's wrong and why tests fail
2. **Logic vs message mismatches** — for EACH validation function, does the actual check match its error message? Compare the threshold/condition in the code to what the error message claims.
3. **Code consistency** — are there any values, limits, or rules that contradict themselves within or across files?
4. **Untested behavior** — are there validation rules whose error messages aren't verified by any test?

Be thorough. Read each validation function completely. Compare what the code DOES to what the error message SAYS.

Do NOT fix anything yet. Write REVIEW.md and call finish().

---

## Phase 2: Fix All Issues

Read your REVIEW.md from Phase 1.

Fix ALL issues listed — both the test failure AND any inconsistencies you documented.

For each fix:
- Make the change
- Verify it's correct

After fixing everything, run `node test/validator.test.js` to confirm tests pass.

Then ask yourself: "Did I fix everything from REVIEW.md, not just the test failure?"

Call finish() with a summary of all changes made.
