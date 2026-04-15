# P0: Fix Bob Model Error — 30+ Hours Down

## Problem
Bob has been failing every heartbeat since 2026-03-26T20:33 (~14.5 hours).
The `gemini-3-pro-preview` model ID is no longer supported by the LiteLLM/GitHub Copilot backend.

Error: `400 litellm.BadRequestError: Github_copilotException - The requested model is not supported. Received Model Group=gemini-3-pro-preview`

## Root Cause
`agents/bob/agent.json` → `"model": "gemini3pro"` → maps to `src/app/may.ts:143` → `id: "gemini-3-pro-preview"`.
The LiteLLM proxy no longer has this model in its routing config.

## Fix Options (simplest first)

### Option A: Change Bob to use opus (fastest, no code change)
```json
// agents/bob/agent.json
"model": "opus"  // was "gemini3pro"
```
Takes effect on next heartbeat (~30 min). No restart needed.

### Option B: Change Bob to use gpt52
```json
// agents/bob/agent.json
"model": "gpt52"  // was "gemini3pro"
```
Same — takes effect on next heartbeat.

### Option C: Fix the model registry (requires restart)
```typescript
// src/app/may.ts:143
id: "gemini-2.5-pro",  // was "gemini-3-pro-preview"
```
Requires binary rebuild + restart. Fixes both bob AND judge (both use gemini3pro).

## Recommendation
Do **Option A** now (immediate relief) + **Option C** later when doing next restart.

## Also Affected
`agents/judge/agent.json` also uses `"model": "gemini3pro"` — would fail if triggered.

## Tracking
- req:5cff555c → tech-lead (CREATED, 30+ min ago)
- req:c45eb581 → may (CREATED, just sent)
