# Finding: Bob Model Configuration Fix Needed

**Date**: 2026-03-27T10:33
**Severity**: P0 — Bob completely down for 28+ hours
**Status**: Needs Hao decision on replacement model

## Problem
Bob uses model `gemini3pro` (agent.json), which maps to `gemini-3-pro-preview` in `src/app/may.ts:143`.
The LiteLLM/Github Copilot backend has deprecated this model ID.
Error: `400 litellm.BadRequestError: Github_copilotException - The requested model is not supported. Received Model Group=gemini-3-pro-preview`

## Impact
- 28+ hours continuous failure (since ~Mar 26 20:00)
- 40+ Bob error sessions, each wasting 0-4 ops
- No architecture guidance, no analysis.md updates, no briefs
- Circuit breaker (once activated) will pause heartbeats, but 3 job entries also fail

## Root Cause
`src/app/may.ts` line 140-146:
```ts
gemini3pro: {
    ...getModel("openai", "gpt-4o"),
    api: "openai-completions" as const,
    id: "gemini-3-pro-preview",  // ← deprecated model ID
    baseUrl: MODEL_BASE_URL,
    apiKey: LITELLM_API_KEY,
},
```

## Fix Options
1. **Update model ID** — Change `gemini-3-pro-preview` to the current Gemini model available on the LiteLLM proxy (e.g., `gemini-2.5-pro`, `gemini-2.0-flash`, etc.). Requires knowing what models the proxy supports.
2. **Switch Bob to different provider** — Use `opus46` or `gpt52` temporarily. Requires agent.json model field update too.
3. **Ask Hao** — Which model should Bob use? Only Hao knows what's available on the LiteLLM proxy.

## Prior Reports
- req:fe5595d9 (sent to May, 01:03 Mar 27)
- req:26b8505b (sent to May, 23:33 Mar 26)
- Neither appears resolved (requests.db is empty/reset)
