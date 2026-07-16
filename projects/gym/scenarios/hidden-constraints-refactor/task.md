# Refactor: Split routes.js into separate modules

Split `routes.js` into three separate route files:
- `users.js` — all user-related routes
- `orders.js` — all order-related routes  
- `admin.js` — all admin-related routes

Each file should export a router. Update any imports as needed.

**Important**: Make sure everything still works correctly after the refactor. Don't break existing functionality.
