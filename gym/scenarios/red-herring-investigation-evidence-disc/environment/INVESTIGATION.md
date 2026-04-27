# Investigation: Intermittent 401 Errors

## Summary
The root cause of the intermittent 401 Unauthorized errors is a race condition in auth.js, specifically in the token validation flow.

## Analysis

### Red Herring: middleware.js TypeError
The error log is dominated by TypeError entries from middleware.js:42. However, this error is completely harmless — it occurs when health check requests from the load balancer don't include an x-request-id header. The error is caught in a try-catch block and the middleware continues normally with an auto-generated request ID. This TypeError is NOT the cause of the 401 errors.

### Real Bug: auth.js Race Condition
The actual bug is in auth.js. When issueToken() creates a new token, it returns the token to the client immediately but updates the tokenStore asynchronously via setTimeout (simulating a database write). There's a 100-250ms delay window where the token exists but is not yet in the store.

When validateToken() is called during this window, it checks tokenStore synchronously and doesn't find the newly-issued token, returning { valid: false }. This causes a 401 response even though the token IS valid — it just hasn't been written to the store yet.

## Recommended Fix
Make the token store write synchronous, or check the pendingTokens array in validateToken() before declaring a token invalid.
