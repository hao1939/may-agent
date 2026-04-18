# Finding: Coach Model Misconfiguration — claude-opus-4.6 Not Available

**Date**: 2026-04-04
**Status**: OPEN (needs Hao/may config change)
**Impact**: Coach sessions fail with 400 Bad Request when ANTHROPIC_API_KEY env var is not set

## Root Cause

In `src/app/may.ts` (line 149-157), the `opus` model is configured with:
```js
opus: {
    ...getModel("anthropic", "claude-sonnet-4-20250514"),
    id: "claude-opus-4.6",
    contextWindow: process.env.ANTHROPIC_API_KEY ? 200000 : 72000,
    baseUrl: ANTHROPIC_DIRECT.baseUrl,
    apiKey: ANTHROPIC_DIRECT.apiKey,
}
```

When `ANTHROPIC_API_KEY` is not set:
- `ANTHROPIC_DIRECT` falls back to `{ baseUrl: MODEL_BASE_URL, apiKey: LITELLM_API_KEY }` (the LiteLLM/GitHub Copilot proxy)
- But the LiteLLM proxy doesn't know about `claude-opus-4.6`
- Result: `400 {"error":{"message":"litellm.BadRequestError: Github_copilotException - Bad Request. Received Model Group=claude-opus-4.6\nAvailable Model Group Fallbacks=None"}}`

## Affected Agent

- **coach** (`agents/_archetypes/coach/agent.json`): `"model": "opus"`
- Any session using the `opus` model key when direct Anthropic API is unavailable

## Evidence

```
Session: agent=coach ops=21 status=error
Error: 400 {"error":{"message":"litellm.BadRequestError: Github_copilotException - Bad Request. Received Model Group=claude-opus-4.6\nAvailable Model Group Fallbacks=None"}}
```

## Fix Options

1. **Change coach to use available model** — set `"model": "gpt52"` or another available model in `_archetypes/coach/agent.json`
2. **Add `claude-opus-4.6` to LiteLLM proxy** — configure the proxy to route this model
3. **Conditional model fallback** — in may.ts, set opus to a proxy-available model when ANTHROPIC_API_KEY is not set
4. **Set ANTHROPIC_API_KEY** — ensure the env var is always available (but adds cost)
