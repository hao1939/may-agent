# Rename getUserData → fetchUserProfile

The function `getUserData` in `userService.js` is being renamed to `fetchUserProfile` for clarity. This function is used across the codebase.

## Requirements

1. **Rename the function** in `userService.js` from `getUserData` to `fetchUserProfile`
2. **Update all call sites** in `dashboard.js`, `api.js`, and `notifications.js`
3. **Update the import/require** statements in each consuming file
4. **Update tests** in `test-user.js` to use the new name
5. **Run the test suite**: `node test-user.js` — all tests must pass with zero failures
6. **Write a CHANGELOG.md** summarizing the rename: include what changed, which files were affected, and why the rename was made (improved clarity)

## Files
- `userService.js` — Core module (PRIMARY CHANGE — rename here)
- `dashboard.js` — Dashboard rendering (calls getUserData)
- `api.js` — API route handlers (calls getUserData)
- `notifications.js` — Notification service (calls getUserData)
- `test-user.js` — Test suite (tests getUserData)

## Constraints
- Do NOT change any business logic — only rename the function
- The module's other exports (`createUser`, `deleteUser`) must remain unchanged
- All tests in `test-user.js` must pass after the rename
- CHANGELOG.md must be created in the project root
