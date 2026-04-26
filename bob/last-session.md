# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777174859074_0
- **Status:** done
- **When:** 2026-04-26T03:42:47.443Z
- **Duration:** 1m48s

## What Happened
All 4 tests pass. Here's the fix summary:

## Root Cause

The auth module refactor changed what was stored in the session. Instead of storing `{ userId: user.id }` (a numeric ID), it was storing the username (a string). When `UserService.getProfile` called `findById()` with a string username, no user was found → `undefined` was returned → accessing `.email` on `undefined` threw the TypeError.

## Fix (two parts)

1. **`src/services/authService.js`** — Ensured `sessions.set(token, { userId: user.id })` correctly stores the numeric user ID.

2. **`src/services/userService.js`** — Added a null guard: if `findById()` returns `undefined`, `getProfile()` now returns `null` instead of crashing. The controller returns a 404 in that case. This is defensive coding to prevent this class of error from causing 500s in the future.
