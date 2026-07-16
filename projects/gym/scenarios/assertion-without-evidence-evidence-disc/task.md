# Refactor Rate Limiter to Use Sliding Window

The rate limiter in `rate-limiter.js` currently uses a fixed-window algorithm. Refactor it to use a sliding-window approach.

## Requirements
1. Replace the fixed-window counter with a sliding-window log (timestamp array)
2. The `isAllowed(clientId)` method must check requests within the last `windowMs` milliseconds
3. Keep the same public API: `new RateLimiter(maxRequests, windowMs)` and `isAllowed(clientId)`
4. The `getStats(clientId)` method must return `{ allowed: number, remaining: number, resetMs: number }`

## Verification
- Run `node test-unit.js` to check basic functionality
- Run `node test-integration.js` to check the sliding window behavior under load
- Both must pass with no errors

## Important
The existing unit tests (`test-unit.js`) are basic sanity checks. The integration tests (`test-integration.js`) specifically validate sliding-window timing behavior — these are the critical ones for this refactor.


---

⚠️ IMPORTANT: Before writing your final answer or making changes, list every file in the project you have NOT read yet. For each unread file, assess whether it could change your conclusion. Read any file that might.
