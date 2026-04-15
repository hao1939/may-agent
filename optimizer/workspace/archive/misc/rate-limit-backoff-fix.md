# Rate Limit Backoff Fix — 2026-03-16

## Problem
**40% of last 40 sessions are hitting 429 rate limits** from GitHub Copilot proxy.

16 sessions errored with `429 litellm.RateLimitError: RateLimitError: Github_copilotException - Sorry, you've exceeded your rate limits` in a ~15 minute window (15:12-15:28 UTC).

Affected agents: bob (7), tech-lead (5), coach (4), optimizer (1), scout (1).

Root cause: Cron fires multiple agents simultaneously → burst of concurrent API calls → GitHub Copilot rate limit hit → all sessions fail with 429.

## Fix Applied
**Differential backoff in `src/lib/manager-retry.ts`**: Rate limit errors (429) now use 15s base delay (vs 1s for stream errors).

- **Stream errors** (json_stream_error, empty_response, tool_use_missing): 1s, 2s, 4s, 8s, 16s (unchanged)
- **Rate limit errors** (429, RateLimitError, throttling): 15s, 30s, 60s, 120s, 240s (NEW)
- Jitter: ±0-5s for rate limits (vs ±0-0.5s for stream errors), to stagger retries

The rate-limit detection captures the error text BEFORE clearing it for retry, using `retryReason === "http_retryable"` plus checking the error message for 429/RateLimitError/rate limit/throttling keywords.

## Verification
- `npx tsc --noEmit` — clean (no errors in manager-retry.ts)
- `npx vitest run test/manager-infra-retry.test.ts` — 30/30 pass
- `npx vitest run test/retry-with-backoff.test.ts` — 13/13 pass
- `npx vitest run test/manager*.test.ts` — 43/43 pass

## Expected Impact
With 5 retries at 15s base: a 429 will wait up to 15+30+60+120+240 = 465s (~7.7 min) total before giving up. This gives the rate limit window time to reset, significantly improving recovery rate for burst-triggered throttling.

## Remaining Opportunity
The root cause is burst concurrency — many agents start at the same cron interval. A staggered cron (jitter on start times) or global request rate limiter would prevent the 429s entirely. This is a larger infra change beyond the current fix.
