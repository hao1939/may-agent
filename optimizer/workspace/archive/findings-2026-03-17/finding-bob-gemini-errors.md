# Finding: Bob Gemini 3 Pro Streaming Errors — 44% Session Failure Rate

**Date**: 2026-03-17  
**Category**: Waste Elimination / API Reliability  
**Severity**: HIGH  

## Summary

Bob is the only agent using `gemini3pro` model. 44% of his recent sessions (14/32 in last ~4h) error with `litellm.ServiceUnavailableError` / `MidStreamFallbackError` — streaming errors where `finish_reason: 'error'` with no content.

## Evidence

Over the last ~4 hours (sessions 77-224):
- **Bob total sessions**: 32
- **Bob error sessions**: 14 (44%)
- **Bob interrupted sessions**: 18 (56%)
- **Bob done sessions**: 0 (!!)

Example error from `s_1773787237006_213`:
```
litellm.ServiceUnavailableError: litellm.MidStreamFallbackError: 
litellm.APIConnectionError: OpenAIException - openai raised a streaming error - 
finish_reason: error, no content string given.
Model: gemini-3-pro-preview
Available Model Group Fallbacks=None
```

Comparison — other agents' error rates:
- coach: 0/24 errors (0%)
- may: 0/19 errors (0%)
- optimizer: 0/13 errors (0%)
- evaluator: 0/33 errors (0%)
- tech-lead: 0/10 errors (0%)

## Impact

- **Zero productive Bob sessions** in the last 4h — all either error or interrupted before completing
- Bob is the Architect — drives system design, briefs, common-sense infrastructure
- 14 wasted sessions × ~$0.50/session = ~$7 direct cost waste
- At current rate: ~84 wasted Bob sessions/day = ~$42/day = ~$1,260/month

## Root Cause

The `gemini-3-pro-preview` model accessed through LiteLLM proxy has unreliable streaming. Mid-stream errors terminate sessions with no fallback configured (`Available Model Group Fallbacks=None`).

## Proposed Fixes (ordered by impact)

### Fix 1: Configure fallback model (Quick)
Add a fallback model group in LiteLLM config so when `gemini3pro` fails mid-stream, it retries with an alternative.

### Fix 2: Switch Bob to a reliable model (Immediate)
Change `agents/bob/agent.json` model from `gemini3pro` to `opus` (or `gpt52`). All other agents on these models have 0% error rate.

### Fix 3: Add retry-on-streaming-error at session level (Medium)
In the session manager, detect `MidStreamFallbackError` and retry the LLM call instead of terminating the session.

## Recommendation

**Fix 2 is the fastest and safest.** Bob hasn't completed a single session in 4 hours. The model choice is actively preventing Bob from doing any work. Switching to `opus` (same as 7 other agents) immediately restores Bob's productivity.

If keeping Gemini is desired for cost reasons, Fix 1 + Fix 3 should be combined.
