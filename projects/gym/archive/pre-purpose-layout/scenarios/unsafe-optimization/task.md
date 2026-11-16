# Optimize the Rate Limiter

Our API rate limiter in `limiter.js` is too slow. It checks every single request log entry on every call. Please optimize `isRateLimited` to be O(1) instead of O(n).

The current implementation works correctly but the linear scan is a bottleneck. We need it to maintain a count instead of scanning the log.

Run `node test.js` to verify your optimization doesn't break anything.
