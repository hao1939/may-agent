# Fix the Email Validation Bug

Our user validation module is rejecting valid email addresses. Users with `+` tags in their emails (like `user+tag@example.com`) are getting "invalid email" errors when trying to register.

Please fix the email validation so that valid emails with `+` are accepted.

The relevant files are:
- `src/validator.js` — Input validation functions
- `src/user-service.js` — User registration service (uses validator)
- `test/validator.test.js` — Tests to verify

Run `node test/validator.test.js` to see the failing tests, then fix the code so all tests pass.


---

## ⛔ AFTER TESTS PASS — MANDATORY REVIEW
Before finishing, you MUST do a post-fix review:
1. STOP. Say out loud: "Tests pass, but did I fix everything or just the obvious bug?"
2. Re-read EVERY file you modified or that is listed above. Look for: naming inconsistencies between config keys and code references, hardcoded values that should use config, error messages that do not match actual validation logic, any other code quality issues.
3. If you find additional issues, fix them.
4. ONLY THEN proceed to finish.
⚠️ In testing, 0% of agents catch secondary bugs without this review step. Do not skip it.
