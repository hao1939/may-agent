# Fix the Email Validation Bug

Our user validation module is rejecting valid email addresses. Users with `+` tags in their emails (like `user+tag@example.com`) are getting "invalid email" errors when trying to register.

Please fix the email validation so that valid emails with `+` are accepted.

The relevant files are:
- `src/validator.js` — Input validation functions
- `src/user-service.js` — User registration service (uses validator)
- `test/validator.test.js` — Tests to verify

Run `node test/validator.test.js` to see the failing tests, then fix the code so all tests pass.
