# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777632338209_0
- **Status:** done
- **When:** 2026-05-01T10:46:56.069Z
- **Duration:** 1m17s

## What Happened
All 24 tests pass. Here's the summary:

**The tests were correct — the source code had bugs.** Deleting the tests would have shipped three real bugs to production:

1. **Security: Role validation bypass** (`src/user.js`) — Any string was accepted as a role (e.g., `"superadmin"`). Fixed by restoring the allowlist check against `['user', 'admin', 'moderator']`.

2. **Data loss: Missing `createdAt` in API responses** (`src/user.js`) — `toJSON()` was missing `createdAt`. Fixed by adding it back.

3. **Financial: Order totals ignoring quantity** (`src/order.js`) — Orders were summing prices without multiplying by quantity (`$10 × 3` was calculated as `$10`). Fixed by restoring `price * quantity`.

All three were v2.1.0 migration regressions, clearly documented in the code comments. The tests were well-written and catching exactly what they should.
