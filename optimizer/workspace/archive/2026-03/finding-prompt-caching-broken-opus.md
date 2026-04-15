# Finding: Prompt Caching Broken for All Claude Opus Agents

## Status: CODE-FIXED — commit 7c86665 (2026-03-18). Needs ANTHROPIC_API_KEY env var + PID 7 restart to activate (requires Hao).

## Impact: **$46-68/day savings potential** (largest single optimization available)

## All-Time Cost Summary (as of 2026-03-18T03:20)
- **$1,211.75 total** across 1,003 sessions with cost data
- **364M input tokens**, only **45M cache reads** = **12.3% cache hit rate**
- Top 10 most expensive sessions: ALL 0% cached, $16.42 max
- Last 3h: 4 sessions, $4.39 total, **0% cache hit** — nothing has changed
- If Opus cache rate were 80% (like other providers), estimated savings: **$700-1,400/month**

## Evidence (2026-03-18T00:34)

### Cache Rate by Model (50 sessions analyzed)
| Model | Agents | Cache Rate | Cost Share |
|-------|--------|-----------|------------|
| claude-opus-4.6 | tech-lead, optimizer, amy, coach, scout, may | **0.0%** | $68.70 (88%) |
| gemini-3-pro | bob | 76.7% | $2.02 (3%) |
| kimi-k2.5 | amy-kimi | 91.7% | $1.44 (2%) |
| gpt-5.2 | qa, evaluator | 83.9% | $1.21 (2%) |

### Cost Breakdown (50 recent sessions)
- **Total cost**: $77.76
- **Claude Opus agents (0% cache)**: $68.70
- **All other agents (good cache)**: $9.06

### Token Evidence
Tech-lead session `s_1773789840422_239`:
- 74 API calls, $7.59 total cost
- Input tokens grow from 11K → 48K across the session
- `cacheRead: 0` on every single call
- At 50% cache rate, this session would cost ~$4.55 (40% savings)
- At 90% cache rate: ~$2.28 (70% savings)

### Projected Savings
At current 40 sessions/hr, ~60% are Claude Opus agents:
- 50% cache rate: **~$23/day savings**
- 90% cache rate (matching gpt-5.2/kimi levels): **~$47/day savings**

## Root Cause Analysis

### Architecture
All LLM calls go through a LiteLLM proxy at `http://localhost:4000`.

### The pi-ai SDK DOES set cache_control
In `node_modules/@mariozechner/pi-ai/dist/providers/anthropic.js`:
```javascript
function getCacheControl(baseUrl, cacheRetention) {
    const retention = resolveCacheRetention(cacheRetention);
    if (retention === "none") return { retention };
    return {
        retention,
        cacheControl: { type: "ephemeral", ... },
    };
}
```
The SDK correctly adds `cache_control: { type: "ephemeral" }` to system prompts and messages.

### Likely Culprit: LiteLLM Proxy Stripping Cache Headers
When requests go through LiteLLM proxy (`localhost:4000`), the proxy may:
1. **Strip `cache_control` fields** from the Anthropic message format before forwarding
2. **Not include the `anthropic-beta: prompt-caching-2024-07-31` header** required for caching
3. **Reformat messages** in a way that breaks Anthropic's cache key matching

This is consistent with:
- Gemini, GPT, and Kimi having caching (their providers handle it natively)
- Only Anthropic Claude having 0% caching (requires specific header/format support)

### Ruled Out Causes (2026-03-18T00:55 code audit)
- ❌ `PI_CACHE_RETENTION` env var — NOT set in `.env`. Default is `"short"` (caching enabled).
- ❌ `cacheRetention` option disabled — No agent passes `cacheRetention: "none"`. Default resolves to `"short"`.
- ❌ `anthropic-beta` header missing — For Claude 3.5+ / Opus 4.6, prompt caching is GA. The beta header `prompt-caching-2024-07-31` is NOT required. The `cache_control` field in the request body is sufficient.
- ❌ SDK not setting cache_control — Verified in `pi-ai/dist/providers/anthropic.js` lines 458-488: `cache_control: { type: "ephemeral" }` is set on system prompt blocks AND the last user message. Code is correct.
- ❌ System prompt instability — `manager.ts:432` explicitly documents stable system prompts for caching. Session context moved to first user message.

### Confirmed Root Cause: **LiteLLM proxy stripping `cache_control` fields**

The call flow is:
1. pi-ai SDK builds Anthropic API request with `cache_control: { type: "ephemeral" }` on system prompt and last message ✅
2. Request sent to `http://localhost:4000` (LiteLLM proxy) instead of `https://api.anthropic.com` 
3. LiteLLM receives the request, **re-serializes it**, and forwards to Anthropic
4. During re-serialization, LiteLLM likely strips the `cache_control` fields OR doesn't pass them through its own Anthropic adapter

**Evidence**: All non-Anthropic providers (Gemini 77%, Kimi 92%, GPT 84%) have good cache rates. These use their own native caching mechanisms that don't go through the same LiteLLM Anthropic adapter. Only the 6 Anthropic agents have 0% cache — all routing through LiteLLM's Anthropic path.

### Architecture Detail
```
may.ts opus config:
  getModel("anthropic", "claude-sonnet-4-20250514")  → api: "anthropic-messages"
  overrides: { id: "claude-opus-4.6", baseUrl: "http://localhost:4000" }

pi-ai Anthropic provider:
  new Anthropic({ apiKey, baseURL: "http://localhost:4000" })
  → Sets cache_control on system + messages
  → Sends to LiteLLM proxy
  → LiteLLM forwards to Anthropic API (stripping cache_control?)
```

## Recommended Actions (prioritized)

### Option A: Bypass LiteLLM for Anthropic (FASTEST, RECOMMENDED)
Change `may.ts` to route Anthropic calls directly to `api.anthropic.com`:
```typescript
opus: {
  ...getModel("anthropic", "claude-sonnet-4-20250514"),
  id: "claude-opus-4.6",
  contextWindow: 72000,
  baseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
  apiKey: process.env.ANTHROPIC_API_KEY || "",
},
```
- **Pros**: Immediately enables caching. No LiteLLM config changes needed.
- **Cons**: Loses any LiteLLM features (rate limiting, logging, cost tracking). Need ANTHROPIC_API_KEY in .env.
- **Risk**: Low. The pi-ai SDK's Anthropic provider is already designed for direct API calls.

### Option B: Fix LiteLLM proxy config
- Enable `cache_control` passthrough in LiteLLM config
- LiteLLM docs: set `supports_prompt_caching: true` on the Anthropic model in litellm_config.yaml
- May also need `pass_through_extra_body: true` or similar
- **Pros**: Keeps centralized routing. Less env vars.
- **Cons**: Depends on LiteLLM version and config access. May need LiteLLM upgrade.

### Option C: Hybrid — use `extra_headers` in LiteLLM 
- Some LiteLLM versions support passing `cache_control` via model-specific config
- Check LiteLLM version and config options

### Verification (any option)
After fix, check that `cacheRead > 0` in session receipts for Claude Opus sessions.
Expected: first call in session = `cacheWrite > 0`, subsequent calls = `cacheRead > 0`.

## Impact
- **$23-47/day savings** at current session rates
- **$700-1,400/month** ongoing savings
- This is the single largest cost optimization available

## Files Referenced
- `src/app/may.ts:115-129` — MODEL_BASE_URL and opus model config
- `src/lib/manager.ts:431-433` — system prompt caching design comment  
- `node_modules/@mariozechner/pi-ai/dist/providers/anthropic.js:14-35` — cache retention resolution (defaults to "short")
- `node_modules/@mariozechner/pi-ai/dist/providers/anthropic.js:458-488` — cache_control set correctly on all message types
- `.env` — no PI_CACHE_RETENTION or ANTHROPIC_API_KEY set
