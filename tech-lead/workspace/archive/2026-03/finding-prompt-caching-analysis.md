# Tech Lead Analysis: Prompt Caching 0% for Claude Opus

**Date**: 2026-03-18T00:40 UTC
**Triggered by**: optimizer req:fe810636
**Impact**: $23-47/day savings potential

## Root Cause Confirmed

The pi-ai SDK **correctly** sets `cache_control: { type: "ephemeral" }` on system prompts and the last user message. This is done in `node_modules/@mariozechner/pi-ai/dist/providers/anthropic.js`:

```javascript
function getCacheControl(baseUrl, cacheRetention) {
    const retention = resolveCacheRetention(cacheRetention);
    if (retention === "none") return { retention };
    return {
        retention,
        cacheControl: { type: "ephemeral", ...(ttl && { ttl }) },
    };
}
```

The default retention is `"short"` (not `"none"`), so caching IS enabled on our side.

The `anthropic-beta: prompt-caching-2024-07-31` header is NOT needed — prompt caching is GA for Claude 3.5+ models. The SDK includes other beta features (`fine-grained-tool-streaming-2025-05-14`).

## The Problem: LiteLLM Proxy

All Claude Opus requests flow through:
```
pi-ai SDK (Anthropic client) → http://host.docker.internal:4000 (LiteLLM) → Anthropic API
```

The model config in `src/app/may.ts:120`:
```typescript
opus: {
    ...getModel("anthropic", "claude-sonnet-4-20250514"),
    id: "claude-opus-4.6",
    contextWindow: 72000,
    baseUrl: MODEL_BASE_URL,  // http://host.docker.internal:4000
    apiKey: LITELLM_API_KEY,
},
```

LiteLLM is likely stripping `cache_control` fields when forwarding requests, or not preserving the Anthropic-specific message format that triggers server-side caching.

Evidence: Non-proxy models (kimi, gemini) achieve 77-92% cache rates. All models going through LiteLLM with Anthropic format show 0%.

## Options (all require Hao)

### Option A: Configure LiteLLM (preferred)
LiteLLM v1.40+ supports Anthropic prompt caching passthrough. Need to verify:
1. LiteLLM version supports `cache_control` passthrough
2. The model config in LiteLLM has `supports_prompt_caching: true`
3. Headers are being forwarded correctly

### Option B: Bypass LiteLLM for Anthropic
Add `ANTHROPIC_API_KEY` env var to the container and change the opus model config:
```typescript
opus: {
    ...getModel("anthropic", "claude-sonnet-4-20250514"),
    id: "claude-opus-4.6",
    contextWindow: 200000,  // native limit without proxy truncation
    baseUrl: "https://api.anthropic.com",
    apiKey: process.env.ANTHROPIC_API_KEY,
},
```
This also removes the 72K context window restriction.

### Option C: Check PI_CACHE_RETENTION env (quick check)
If `PI_CACHE_RETENTION=none` is set anywhere in the Docker environment, that would disable caching. Currently NOT set in `.env` but could be in Dockerfile/compose.

## What I CAN'T Do From Here
- I cannot access the LiteLLM proxy config (runs on host machine)
- I cannot set `ANTHROPIC_API_KEY` (not in .env, not in container env)
- I cannot trigger a process restart (requires Telegram/socket bus command)

## Recommendation
Escalate to Hao with:
1. Quick win: Check if `PI_CACHE_RETENTION=none` is set in Docker compose/Dockerfile
2. Medium: Configure LiteLLM to support Anthropic prompt caching passthrough
3. If LiteLLM can't be configured: bypass it for Anthropic calls (Option B)
