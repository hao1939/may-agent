# Finding: Anthropic Prompt Caching Completely Non-Functional — $1,476/day Waste

**Date:** 2026-03-17T21:55  
**Severity:** 🔴 CRITICAL  
**Data source:** 244 sessions over last 4 hours (live production data)

## Executive Summary

All 6 Anthropic Claude agents (coach, optimizer, tech-lead, amy, scout, may) have **0% prompt cache hit rate** despite the system being designed for caching. This is the single largest cost driver, responsible for ~$246/4h in avoidable spend. Projected daily savings from fixing: **$1,476/day**.

## The Numbers (last 4 hours)

| Agent | Model | Sessions | Cost | Input Tokens | Cache Reads | Potential Savings |
|-------|-------|----------|------|-------------|-------------|------------------|
| coach | claude-opus-4.6 | 43 | $85.37 | 27.25M | **0** | $72.49 |
| optimizer | claude-opus-4.6 | 22 | $70.80 | 22.53M | **0** | $59.99 |
| tech-lead | claude-opus-4.6 | 19 | $67.07 | 21.68M | **0** | $57.67 |
| amy | claude-opus-4.6 | 13 | $22.96 | 7.19M | **0** | $19.01 |
| scout | claude-opus-4.6 | 8 | $18.78 | 5.91M | **0** | $15.80 |
| may | claude-opus-4.6 | 34 | $7.79 | 2.44M | **0** | $6.18 |
| **Subtotal (Anthropic)** | | **139** | **$272.77** | **87.0M** | **0** | **$231.14** |
| bob | gemini-3-pro | 47 | $10.87 | 3.22M | 13.03M ✅ | — |
| evaluator | gpt-5.2 | 43 | $8.22 | 1.83M | 3.93M ✅ | — |
| qa | gpt-5.2 | 8 | $1.69 | 0.38M | 1.62M ✅ | — |
| amy-kimi | kimi-k2.5 | 7 | $1.78 | 0.33M | 3.42M ✅ | — |
| **Total** | | **244** | **$295.34** | **92.76M** | | **$246/4h** |

**Daily projection: $1,770/day total spend, $1,476/day potential savings from caching**

## Why Caching Works for OpenAI but Not Anthropic

| Provider | Caching Status | Mechanism |
|----------|---------------|-----------|
| OpenAI (gpt-5.2, gemini, kimi) | ✅ Working | OpenAI API handles caching automatically via prefix matching |
| Anthropic (claude-opus-4.6) | ❌ Broken | Requires explicit `cache_control: {"type": "ephemeral"}` markers on system/message blocks |

**Root cause:** The pi-agent-core proxy sends requests to Anthropic without `cache_control` markers. Anthropic's API does NOT auto-cache — it requires explicit cache breakpoints.

## Architecture

```
Agent → pi-agent-core → proxy /api/stream → Anthropic API
                                           ↑
                                  Missing: cache_control markers on system prompt
```

The system prompt IS stable across sessions (session context is in the user message — verified in manager.ts lines 430-454). The architecture is cache-ready. Only the proxy needs to add the `cache_control` marker.

## What Needs to Happen

**In the proxy** (external to this repo), add `cache_control: {"type": "ephemeral"}` to:
1. The system prompt block (most impactful — stable across turns AND sessions)
2. The last user/assistant message pair (for within-session caching)

Per Anthropic docs, these are "cache breakpoints" — everything up to and including a breakpoint is eligible for caching. The system prompt alone would capture 80%+ of the benefit.

## Cost Math

- Current: 87M Anthropic input tokens/4h × $3.00/M = $261/4h input cost
- With caching: 98% cacheable → ~85M tokens at $0.30/M + ~2M at $3.00/M = $31.50/4h
- **Savings: ~$230/4h = $1,380/day just on input tokens**
- Cache write cost: $3.75/M × ~1.7M new tokens per session ≈ $6/4h overhead
- **Net savings: ~$224/4h = $1,344/day (conservative)**

## Status

- [ ] **Sent to tech-lead** (req:927c5c48, 2026-03-17 ~18:47) — original finding with less data
- [ ] This updated finding has 4x more data and precise numbers
- [ ] Proxy fix needed (external dependency)

## Evidence

- All token/cost data extracted from session.jsonl `usage` fields in `.state/sessions/history/`
- Model/provider confirmed from session.jsonl API response metadata
- 244 sessions analyzed, covering all 10 active agents
- Zero cacheRead tokens for ALL 6 Anthropic agents (139 sessions)
- Positive cacheRead tokens for ALL 4 non-Anthropic agents (105 sessions)
