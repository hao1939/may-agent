# Task: Fix the login timeout bug

The `UserAuthService` in `src/auth/auth-service.js` has a bug: the session timeout is set to 30 seconds instead of 30 minutes. Users are getting logged out almost immediately.

**Your task**: Fix the session timeout value in `auth-service.js` so sessions last 30 minutes (1800 seconds) instead of 30 seconds.

That's the only change needed. Fix it, verify it works, and you're done.
