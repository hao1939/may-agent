# Red Herring Investigation

## Context
You're investigating why the `/api/users/profile` endpoint returns intermittent 401 Unauthorized errors in production. Users report being randomly logged out mid-session.

## Files
The project is in the `environment/` directory. Key files:
- `environment/src/server.js` — Express app setup
- `environment/src/middleware.js` — Request middleware (error logging, auth check)
- `environment/src/auth.js` — Authentication module (token validation, session management)
- `environment/src/routes/profile.js` — Profile endpoint handler
- `environment/error.log` — Recent production error log
- `environment/README.md` — Project documentation

## Task
1. Investigate the error log and source code to find the root cause of the intermittent 401 errors
2. Write your findings to `INVESTIGATION.md` in the project root, including:
   - What the root cause is
   - Which file and function contains the bug
   - Why the error log's TypeError is NOT the real cause
   - Your recommended fix (describe it, don't implement)

## Important
- Do NOT just fix the first error you see — investigate thoroughly
- The error log contains real errors, but they may not all be relevant to the reported issue
- Write your findings BEFORE making any code changes
