# Finding: LiteLLM Strips Prompt Caching → $143/day Waste

**Date:** 2026-04-10  
**Severity:** P0 — Largest single cost optimization opportunity found  
**Impact:** ~$143/day savings (~$4,300/month)

## Summary

All Anthropic-model agents (bob, coach, may, optimizer, scout, tech-lead) route through LiteLLM, which **strips `cache_control` fields** from API requests. This breaks Anthropic prompt caching entirely, despite the codebase being carefully designed for it.

## Evidence

| Metric | Value |
|--------|-------|
| Anthropic agents 24h input tokens | 75.5M |
| Anthropic agents 24h cost | $266.78 |
| Cache read tokens (24h) | **0** |
| Cache write tokens (24h) | **0** |
| QA (gpt52, for comparison) cache reads | 8.6M tokens |
| Bob alone (24h projected cost) | ~$93/day |

## Root Cause

1. `ANTHROPIC_API_KEY` environment variable is **not set** in the deployment
2. Code at `src/app/may.ts:148-165` checks for `ANTHROPIC_API_KEY`:
   - **If set**: routes to `api.anthropic.com` directly (cache-friendly, 200K context window)
   - **If not set**: routes to `MODEL_BASE_URL` (LiteLLM at `http://litellm:4000`, 72K context window)
3. LiteLLM proxy strips `cache_control` fields from requests → Anthropic never sees caching hints
4. Comment in code explicitly warns: _"LiteLLM strips cache_control fields, breaking prompt caching (~40% cost savings)"_

## Cost Model

Anthropic Claude caching pricing:
- **Input tokens**: $3/1M tokens
- **Cache read tokens**: $0.30/1M tokens (90% cheaper)
- **Cache write tokens**: $3.75/1M tokens (25% more expensive, one-time)

With 70% estimated cache hit rate (conservative — system prompt is stable, conversations are long):
- Current input cost: ~$226/day
- With caching: ~$84/day
- **Daily savings: ~$143**

## Fix

**Operator action required**: Set `ANTHROPIC_API_KEY` in the deployment environment.

The code already handles this correctly — the bypass path and cache-friendly prompt architecture are in place. Only the environment variable is missing.

### Secondary Benefits of the Fix
1. Context window increases from 72K → 200K tokens (enables longer sessions)
2. Removes LiteLLM as a potential latency/reliability bottleneck for Anthropic calls
3. May reduce token-per-turn costs since the API supports prompt caching natively

## Additional Observations

- The codebase has extensive "KV-Cache Discipline" (P147) — system prompts are designed with stable sections first, dynamic content last
- `resolveCacheRetention()` in pi-ai defaults to `"short"` — the library is ready
- QA agent uses gpt52 (OpenAI) and DOES get cache hits — confirming the infrastructure works

## Status

**Blocked on operator**: Cannot set environment variables. Escalated to Hao.
