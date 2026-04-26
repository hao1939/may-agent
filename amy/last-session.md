# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777178791289_0
- **Status:** done
- **When:** 2026-04-26T04:46:57.947Z
- **Duration:** 26s

## What Happened
The bug is in `auth.js`. The `createSession` stores just the raw `userId` number, and `authMiddleware` sets `req.user = sessions[token]` (a number). Then `userService.getProfile(user)` tries `user.id` on a number, gets `undefined`, lookup fails, and `fullUser.email` throws.

Fix: wrap the session data back into an object in `authMiddleware`:
