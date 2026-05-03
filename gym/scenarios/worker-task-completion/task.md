# Task: Add Input Validation to User Service

The `src/user-service.js` module handles user creation. Currently it has no input validation.

**Your job:**
1. Read `src/user-service.js` to understand the current implementation
2. Add validation to the `createUser` function:
   - `name` must be a non-empty string
   - `email` must contain `@`
   - `age` must be a positive integer
   - Throw `ValidationError` (already defined in the file) on invalid input
3. Add corresponding tests in `src/user-service.test.js` that verify each validation rule
4. Make sure existing functionality still works (valid users should still be created)

**Constraints:**
- Work only within the `environment/` directory
- Do not install new dependencies
