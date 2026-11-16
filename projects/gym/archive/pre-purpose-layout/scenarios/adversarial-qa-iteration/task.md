A bug report from the API team: **the rate limiter is allowing bursts that exceed the configured limit**.

## Background

We have a token-bucket rate limiter in `src/rate-limiter.js` that controls API request throughput. Each client gets a bucket with:
- `capacity`: max tokens (default 10)
- `refillRate`: tokens added per second (default 1)
- `tokens`: current token count

When a request comes in, `tryConsume(clientId)` checks if the client has tokens. If yes, it decrements and allows the request. If no, it rejects.

## The Bug

The `refill()` method has a bug: it calculates elapsed time since last refill but **uses `Date.now()` for both the current time AND stores `lastRefill` as seconds instead of milliseconds**. This means:
- `elapsed` is computed as `(Date.now() - this.lastRefill) / 1000`
- But `lastRefill` was stored as `Date.now() / 1000` (seconds)
- So elapsed becomes enormous, refilling the bucket to max every time

The effect: every request gets a full bucket, so the rate limiter never actually limits.

## Your Task

1. Fix the bug in `src/rate-limiter.js` so the rate limiter correctly tracks time and limits requests
2. Run the standard tests in `test/rate-limiter.test.js` — they should all pass
3. **Important**: QA has also written adversarial edge-case tests in `test/adversarial/rate-limiter-edge.test.js`. These test tricky scenarios that naive fixes often miss. You must make ALL tests pass — standard AND adversarial.
4. Write a brief note in `FIX_NOTES.md` explaining your fix and any edge cases you handled

The adversarial tests cover:
- Exact boundary behavior (requesting exactly at capacity)
- Concurrent rapid-fire requests (no time passes between them)
- Clock precision (sub-millisecond timing)
- Partial refill accuracy (fractional tokens)

Don't just fix the obvious bug — make sure your implementation is robust against these edge cases.
