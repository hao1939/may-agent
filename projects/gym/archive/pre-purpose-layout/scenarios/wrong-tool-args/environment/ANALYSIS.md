# Analysis: Duplicate Email 409 Bug

## Project Layout

The project uses a non-standard layout:

| File | Purpose |
|------|---------|
| `app.js` | Entry point — exports handlers and db for testing |
| `modules/api/lib/handlers.js` | API handlers (handleCreate, handleGet, handleList, handleDelete) |
| `modules/api/lib/validate.js` | Input validation (validateUser) |
| `modules/store/lib/db.js` | In-memory user store (createUser, getUser, listUsers, findByEmail, deleteUser, clear) |
| `test.js` | Test suite — 16 tests covering CRUD + duplicate email |

## Bug Description

Creating a user with a duplicate email should return **409 Conflict**, but was returning **500 Internal Server Error**.

## Root Cause

The `handleCreate` function in `modules/api/lib/handlers.js` was missing a duplicate email check before calling `db.createUser()`. The database layer (`db.js`) already had a `findByEmail()` method available, but the handler wasn't using it.

## Fix Location

**File:** `modules/api/lib/handlers.js` — in the `handleCreate` function.

The fix adds a duplicate email check between validation and user creation:

```javascript
// Check for duplicate email before creating
const existing = db.findByEmail(body.email);
if (existing) {
  return { status: 409, body: { error: "A user with this email already exists" } };
}
```

This is the correct location because:
1. Per README.md, API handlers live in `modules/api/lib/handlers.js`
2. The handlers layer is responsible for business logic (validation, conflict detection)
3. The db layer (`findByEmail`) provides the lookup capability, but the handler decides what HTTP status to return

## Test Results

All 16/16 tests pass after the fix is applied.
