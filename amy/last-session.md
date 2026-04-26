# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777182247615_0
- **Status:** done
- **When:** 2026-04-26T05:44:29.570Z
- **Duration:** 21s

## What Happened
The bug is in `src/middleware/auth.js`. `createSession` stores a raw userId instead of `{ id: userId }`, so `req.user` is a number, and `user.id` in `getProfile` is `undefined`.
