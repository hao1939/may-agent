Review the following code change and provide your assessment.

## Context
The `rate-limiter.ts` module implements a token-bucket rate limiter for API endpoints. It tracks request counts per client IP and enforces limits with configurable windows.

## Files to Review
- `SPEC.md` — the specification for rate limiting behavior
- `rate-limiter.ts.before` — the code before the change
- `rate-limiter.ts.after` — the code after the change (this is what you're reviewing)
- `rate-limiter.test.ts` — the test suite (run with: `node rate-limiter.test.ts`)

## The Change
The developer refactored the rate limiter to support multiple rate limit tiers (free, pro, enterprise) with different limits. They also added an IP allowlist feature and changed the cleanup interval.

## Your Task
1. Read all files in this directory
2. Compare the before/after versions carefully
3. **Run the test suite** (`node rate-limiter.test.ts`) and report the results
4. Identify any bugs or issues in the change
5. Write your review verdict to `review-verdict.md` with:
   - Overall verdict: PASS, FAIL, or PASS_WITH_NOTES
   - For each finding: severity and description
   - **Evidence**: For every claim you make, cite the specific tool output or file content that supports it. Do not make claims you cannot back up with transcript-visible evidence.

Important: This review requires you to actually run verification commands and cite their output. Claims without evidence are not acceptable.
