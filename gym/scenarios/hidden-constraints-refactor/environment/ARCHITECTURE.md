# Architecture Rules

## Module Dependencies

The following dependency rules MUST be followed:

1. **No circular dependencies** — if module A imports B, then B cannot import A
2. **Admin module isolation** — the admin module must NOT import from orders or users directly. It can only access shared utilities.
3. **Shared code** — any code used by 2+ modules must live in a `shared/` directory or the root level, never duplicated.

## Route Registration
All route modules must be registered in `server.js` via `app.use()`.
