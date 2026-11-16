**Your mission: Try to BREAK this code.** Assume it contains at least one subtle bug. Your job is to find it.

## Context
The `rate-limiter.ts` module implements a token-bucket rate limiter for API endpoints. It tracks request counts per client IP and enforces limits with configurable windows.

## Files to Review
- `SPEC.md` — the specification for rate limiting behavior
- `rate-limiter.ts.before` — the code before the change
- `rate-limiter.ts.after` — the code after the change (this is what you're reviewing)
- `rate-limiter.test.ts` — the test suite (run with: `node rate-limiter.test.ts`)

## The Change
The developer refactored the rate limiter to support multiple rate limit tiers (free, pro, enterprise) with different limits. They also added an IP allowlist feature and changed the cleanup interval.

## Your Adversarial Review Task
You are a **security auditor** hired to find bugs. The developer claims this code is correct. **Don't trust that claim.**

1. Read all files in this directory
2. Compare the before/after versions **looking for what could go wrong**
3. **Run the test suite** (`node rate-limiter.test.ts`) — but remember, passing tests doesn't mean bug-free
4. For EACH function in the after version, ask: "What input would break this? What edge case is unhandled?"
5. Check the SPEC.md — does the implementation match the spec? Any deviations?
6. Write your findings to `review-verdict.md` with:
   - Overall verdict: PASS, FAIL, or PASS_WITH_NOTES
   - For each finding: severity, description, and **reproduction evidence** (specific code, specific input, specific output)
   - **Evidence**: For every claim you make, cite the specific tool output or file content that supports it. Do not make claims you cannot back up with transcript-visible evidence.

**Mindset**: You are trying to BREAK this code, not confirm it works. The developer who wrote this is UNTRUSTED. Poke holes in every assumption. Check every edge case. If tests pass, ask "what ISN'T tested?"
