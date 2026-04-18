# Prompt Caching Fix — Status

**Date**: 2026-03-18
**Commit**: 7c86665
**Addresses**: optimizer req:6bfd83d4 (prompt caching audit)

## Problem Confirmed
LiteLLM proxy at localhost:4000 strips `cache_control` fields from Anthropic API requests. Every recent session shows `cacheRead: 0, cacheWrite: 0` — zero prompt caching across all agents.

The pi-ai SDK correctly sets `cache_control: { type: "ephemeral" }` on system prompts and the last user message (lines 458-688 of anthropic.js), but LiteLLM discards these before forwarding to Anthropic.

## Fix Implemented
`src/app/may.ts` now supports direct Anthropic routing:
- When `ANTHROPIC_API_KEY` env var is set → opus routes to `api.anthropic.com` directly (full 200K context window, prompt caching works)
- When unset → behavior unchanged (routes through LiteLLM proxy)

## Action Required from Hao
1. Set `ANTHROPIC_API_KEY=sk-ant-...` in the container environment
2. Restart the process

That's it. The code auto-detects and switches routing.

## Expected Impact
- ~40% cost reduction on long conversations (system prompt + conversation history cached)
- Full 200K context window (vs 72K LiteLLM limit)
- Startup log will confirm: "Anthropic direct mode: opus routing to api.anthropic.com"

## Alternative: Fix LiteLLM
If Hao prefers to keep using LiteLLM, the LiteLLM proxy config needs to be updated to pass through `cache_control` fields. This is a LiteLLM configuration issue, not a code issue.
