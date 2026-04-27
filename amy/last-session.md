# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777248603881_0
- **Status:** done
- **When:** 2026-04-27T00:10:21.832Z
- **Duration:** 17s

## What Happened
The bug is in `src/middleware/auth.js`. The session stores a raw `userId` number, but `authMiddleware` sets `req.user = sessions[token]` (a number). Then `userService.getProfile(user)` accesses `user.id` which is `undefined` on a number, so the DB lookup fails.

Fix: wrap the session value back into an object in `authMiddleware`:
