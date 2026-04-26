# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777190473623_0
- **Status:** done
- **When:** 2026-04-26T08:01:27.699Z
- **Duration:** 14s

## What Happened
The bug is in `src/middleware/auth.js`. `createSession` stores the raw `userId` instead of `{ id: userId }`, so `req.user` is a number, and `user.id` in `getProfile` is `undefined`.
