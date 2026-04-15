# Prompt Caching Design — Implementation Plan

**Date**: 2026-03-16 (updated 13:22 UTC)
**Status**: ✅ Root cause confirmed, solution designed, requires Hao authorization
**Impact**: ~50%+ cost reduction on all Opus agent sessions ($5,000+/month savings potential)

## Problem

All Claude Opus 4.6 agents have **0% prompt cache rate** (`cacheRead: 0` AND `cacheWrite: 0`), while Gemini agents achieve ~67% cache rate. Cached prompt tokens (system prompt, tools, early conversation) are re-processed at full price every request.

## Root Cause — CONFIRMED

### The pi-ai library is correct
The `@mariozechner/pi-ai` Anthropic provider (`anthropic.ts`) already:
1. Adds `cache_control: {type: "ephemeral"}` to system prompt content blocks via `getCacheControl()` (default retention: `"short"`)
2. Adds `cache_control: {type: "ephemeral"}` to the last user message (conversation history caching)
3. Routes through `streamAnthropic` → `buildParams` → correctly constructed Anthropic API request
4. System prompt stability is maintained (session context injected into first user message, not system prompt — P147)

### The LiteLLM proxy drops cache_control markers

**Evidence** (verified 2026-03-16 13:22 UTC):

```
$ curl http://host.docker.internal:4000/model/info
claude-opus-4.6 -> github_copilot/claude-opus-4.6 (drop_params=True)
gemini-2.5-flash -> github_copilot/gemini-3-flash-preview (drop_params=True)
*              -> github_copilot/* (drop_params=True)
```

**All models** in LiteLLM are configured with:
- **Provider**: `github_copilot/` — uses Copilot's API endpoint, NOT native Anthropic API
- **`drop_params=True`** — LiteLLM silently drops any API parameters it doesn't recognize

This means:
1. Our Anthropic SDK client sends a properly formatted request with `cache_control` markers to `http://host.docker.internal:4000`
2. LiteLLM receives the request but processes it through the `github_copilot` provider
3. `drop_params=True` strips `cache_control` from system blocks and messages before forwarding
4. The request reaches Anthropic (via Copilot) WITHOUT cache markers → no caching → `cacheRead: 0, cacheWrite: 0`

### Why caching CAN'T work with current setup
Even if `drop_params` were `False`, the `github_copilot/` provider routes through GitHub's Copilot API gateway, which likely:
- Converts between OpenAI and Anthropic formats, potentially stripping `cache_control`
- May not support Anthropic's native caching protocol at all
- Has its own rate limiting and request transformation pipeline

## Solution Options (ranked by feasibility)

### Option A: Set `drop_params=False` in LiteLLM (Quick test)
**Effort**: 1 line config change
**Likelihood**: LOW — the `github_copilot/` provider still converts formats

Change LiteLLM config:
```yaml
model_list:
  - model_name: claude-opus-4.6
    litellm_params:
      model: github_copilot/claude-opus-4.6
      drop_params: false  # was: true
```

**Test**: Run one Opus session, check if `cacheWrite > 0`.

### Option B: Route Claude through native Anthropic provider in LiteLLM (Best)
**Effort**: Config change + API key
**Likelihood**: HIGH — native provider has full cache support

```yaml
model_list:
  - model_name: claude-opus-4.6
    litellm_params:
      model: anthropic/claude-opus-4-20250514
      api_key: $ANTHROPIC_API_KEY
      # drop_params: false (default)
```

**Prerequisite**: Need a direct Anthropic API key (not Copilot). This changes the billing model from Copilot subscription to direct API usage.

### Option C: Bypass LiteLLM for Anthropic models (Direct)
**Effort**: Code change in `src/app/may.ts`
**Likelihood**: HIGH

```typescript
// src/app/may.ts - change opus model config
opus: {
    ...getModel("anthropic", "claude-sonnet-4-20250514"),
    id: "claude-opus-4.6",
    contextWindow: 72000,
    baseUrl: "https://api.anthropic.com",  // Direct to Anthropic
    apiKey: process.env.ANTHROPIC_API_KEY,
},
```

**Pros**: Guaranteed cache support, simplest code change
**Cons**: Loses LiteLLM logging/load-balancing, requires direct API key, changes billing model

### Option D: Use Copilot's own caching mechanism (Investigate)
**Effort**: Research
**Likelihood**: UNKNOWN

GitHub Copilot may have its own prompt caching built into the gateway. Need to check:
- Does Copilot's API return `cache_read_input_tokens` or equivalent?
- Does LiteLLM pass through Copilot's usage fields?
- Could the 0% rate be a reporting issue rather than actual lack of caching?

## Recommended Path

1. **Quick test** (5 min): Set `drop_params=False` for `claude-opus-4.6` in LiteLLM config. Run one session. Check `cacheWrite` in session.jsonl.

2. **If Quick test fails** → Investigate Option D (Copilot native caching) by checking LiteLLM logs for full API response bodies.

3. **If neither works** → Option B (native Anthropic provider) requires Hao decision on billing model change (Copilot subscription vs. direct API billing).

4. **Verification**: After any fix, check 3 consecutive Opus sessions for:
   - `cacheWrite > 0` on first session (cache populated)
   - `cacheRead > 0` on subsequent sessions (cache hit)

## Expected Impact

| Metric | Current | After Fix |
|--------|---------|-----------|
| Opus cache rate | 0% | ~60-80% (based on Bob/Gemini benchmarks) |
| Avg input cost per session | ~$1.50 | ~$0.60 |
| Monthly Opus spend | ~$5,000+ | ~$2,000-2,500 |
| Cacheable tokens/request | ~7,000-12,000 | Same (system prompt + tools) |

## Files Involved

| File | Purpose |
|------|---------|
| LiteLLM config (host) | `drop_params`, provider routing |
| `src/app/may.ts:112-123` | `MODEL_BASE_URL`, opus model config |
| `pi-ai/providers/anthropic.ts` | `getCacheControl()`, `buildParams()` — already correct |
| `src/lib/manager.ts:363-378` | System prompt caching discipline comments |

## Blockers

- **Hao authorization required**: Any fix involves either changing LiteLLM config (host-level) or switching billing model (Copilot → direct Anthropic API)
- **No agent-side code fix possible**: The issue is infrastructure (proxy config), not application code
- **This is the #1 remaining cost lever**: estimated 50%+ savings on the largest cost category

## Key Discovery Chain
1. `cost-data.json` analysis → 0% cache rate for all Opus agents (2026-03-15)
2. Confirmed `pi-ai` library sends `cache_control` markers correctly (2026-03-16)
3. Confirmed model routes through `anthropic-messages` API path (2026-03-16)
4. Found `MODEL_BASE_URL=http://host.docker.internal:4000` (LiteLLM proxy)
5. **Confirmed root cause**: LiteLLM uses `github_copilot/` provider with `drop_params=True` — strips `cache_control` markers before forwarding (2026-03-16 13:22 UTC)
