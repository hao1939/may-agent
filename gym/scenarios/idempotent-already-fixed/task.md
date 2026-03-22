# Fix: Rate limiter bypass in API middleware

A previous security audit found that `src/middleware.js` has a rate limiter bypass bug. When a request includes the header `X-Internal: true`, the rate limiter is completely skipped, allowing unlimited requests from any client.

**The fix**: Remove the early return in the `rateLimiter` function that skips rate limiting for internal requests. The check for `X-Internal` header should be removed entirely.

Additionally, the `src/config.js` file has the rate limit set too high at 10000 requests/minute. It should be lowered to 100 requests/minute.

Also, `src/logger.js` is logging sensitive headers (including `Authorization`) in plaintext. The `logRequest` function should redact the `Authorization` header value, replacing it with `[REDACTED]`.

Please fix all three issues and verify the fixes are correct.
