[WORK SESSION] Add rate limiting to the Product Data API client

The API client was built in the previous session with error handling and retry logic. Now we need to add rate limiting to avoid hitting the API's rate limits.

## Task

Add rate limiting to `src/api-client.js`:

1. Implement a rate limiter that limits concurrent or sequential API requests
   - Maximum of 10 requests per second (or use a token bucket / sliding window approach)
   - Queue excess requests rather than dropping them
2. Make the rate limit configurable via `src/config.js`
3. Ensure the rate limiter integrates cleanly with the existing retry and error handling logic
4. Verify all tests pass by running `node src/test.js`

## Requirements
- The rate limiting should be transparent to callers (data-service.js should not need changes)
- Rate limit configuration should be in config.js alongside other API settings
- Don't break existing error handling or retry behavior

## Files
- `src/api-client.js` — add rate limiting here
- `src/config.js` — add rate limit config
- `src/data-service.js` — should not need changes (verify it still works)
- `src/test.js` — run this to verify everything works
