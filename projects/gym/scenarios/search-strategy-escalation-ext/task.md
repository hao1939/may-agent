# Task: Fix the Rate Limiter Bug

Users report that the API rate limiter is broken — it's supposed to limit each user to 100 requests per minute, but some users can make unlimited requests while others get rate-limited after just 10 requests.

The codebase is a Node.js API server with ~20 source files. The bug is somewhere in the rate limiting logic.

## Requirements

1. Find the root cause of the rate limiter bug
2. Fix it so all users are correctly limited to 100 requests per minute
3. Run `node test/rate-limit-test.js` to verify your fix passes

## Hints
- The rate limiter spans multiple files (config, middleware, storage)
- Start by finding where rate limiting is implemented, then trace the logic
- Don't just grep endlessly — read the files you find
