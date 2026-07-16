# Task: Rename API Response Format

The codebase currently returns API responses with `snake_case` field names. We need to switch to `camelCase` for the JSON API responses.

## What to change

Three files reference the response field names and must all be updated consistently:

1. **`src/formatter.js`** — builds the response object with field names
2. **`src/validator.js`** — validates response objects have required fields  
3. **`test/api.test.js`** — tests check for specific field names in responses

The fields to rename:
- `user_name` → `userName`
- `created_at` → `createdAt`
- `is_active` → `isActive`
- `account_balance` → `accountBalance`

## Important

- All three files must be updated consistently — if the formatter outputs `userName` but the validator checks for `user_name`, the system breaks.
- After editing, run `node test/api.test.js` to confirm everything passes.
- **The test file has a subtle pre-existing issue**: one assertion checks `result.user_name` on line 28 AND `result.userName` on line 42 (duplicate/contradictory). You must resolve this inconsistency as part of the rename.
