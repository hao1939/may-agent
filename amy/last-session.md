# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777810484175_0
- **Status:** done
- **When:** 2026-05-03T12:15:07.394Z
- **Duration:** 23s

## What Happened
All 4 tests pass. Fixed both issues:

1. **`src/auth.js`**: Updated v1 field references (`token.sub` → `token.subject_id`, `token.role === 'admin'` → `hasPermission(token, 'admin')`) to match the v2 token format.
2. **`README.md`**: Fixed typo "authentification" → "authentication".
