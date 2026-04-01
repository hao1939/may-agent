# Accepted Work — 2026-03-23T19:23Z

## req:fff666 — Fix critical memory leak in worker pool (CRITICAL)
**Priority**: Critical — production impact, OOM kills every 8 hours
**Plan**:
1. Investigate `src/workers/pool.js`, specifically the `spawnWorker()` function
2. Identify event listeners not being cleaned up on worker recycle
3. Add proper `removeListener`/`removeAllListeners` calls in the worker cleanup path
4. Verify fix with a memory profile or stress test

## req:ccc333 — Implement API rate limiting middleware (MEDIUM)
**Priority**: Medium
**Plan**:
1. Create rate limiting middleware supporting per-endpoint and per-API-key limits
2. Make limits configurable (env vars or config file)
3. Apply middleware to all public API endpoints
4. Add tests for rate limiting behavior

## req:ggg777 — Add unit tests for new auth module (MEDIUM)
**Priority**: Medium
**Plan**:
1. Review `src/auth/` module to understand the API surface
2. Write unit tests covering: login flow, token refresh, permission checks, session management
3. Ensure test coverage for edge cases and error paths
4. Integrate with existing test runner
