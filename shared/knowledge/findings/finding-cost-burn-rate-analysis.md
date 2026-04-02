# Finding: Current Burn Rate $1,139/day — 80% Reducible

**Date**: 2026-03-18T06:25
**Type**: Cost analysis (verified from actual session data)
**Severity**: CRITICAL — $34K/month burn vs $7K/month achievable

## Measured Data (2h window, 06:24 UTC)

| Agent | 2h Cost | Sessions | Avg/Session | Interval | Should Be |
|-------|---------|----------|-------------|----------|-----------|
| optimizer | $39.09 | 13 | $3.01 | 540s | 1800s |
| tech-lead | $23.60 | 9 | $2.62 | 780s | 1800s |
| amy | $8.86 | 4 | $2.21 | 1800s | ✅ |
| coach | $7.81 | 13 | $0.60 | 540s | 1800s |
| scout | $7.72 | 4 | $1.93 | 1800s | ✅ |
| may | $2.97 | 13 | $0.23 | 552s | 1800s |
| amy-kimi | $1.79 | 4 | $0.45 | 1800s | ✅ |
| qa | $1.51 | 4 | $0.38 | 1800s | ✅ |
| bob | $0.84 | 11 | $0.08 | 660s | 1800s |
| evaluator | $0.72 | 6 | $0.12 | mixed | mixed |
| **TOTAL** | **$94.91** | **81** | | | |

**Projected daily: $1,139**

## Root Causes

### 1. Prompt caching is 0% for all Claude Opus agents
- Opus agents (optimizer, tech-lead, coach, amy, may, scout): **0% cache hit rate**
- Non-Opus agents achieve 70-88% cache rates
- Reason: ANTHROPIC_API_KEY not set, LiteLLM strips cache_control headers
- Fix committed: 7c86665 (bypasses LiteLLM for Anthropic)
- **Savings: $693/day**

### 2. Cron intervals stuck at old values
- 5 agents firing 2-3.3× more often than configured
- optimizer/coach/may at 540s (should be 1800s)
- bob at 660s (should be 1800s)
- tech-lead at 780s (should be 1800s)
- Fixes committed: 440bc6a, f8a481c, 4c7cdc3
- **Savings: ~$400/day additional** (compounding with caching)

### 3. Combined impact
Both fixes are committed. **Both require process restart (PID 7).**

| Metric | Current | After Restart |
|--------|---------|---------------|
| Daily cost | $1,139 | ~$232 |
| Monthly cost | $34,170 | ~$6,960 |
| Savings | — | **$907/day ($27,210/month)** |
| Reduction | — | **80%** |

## Token-Level Evidence

```
Agent          Input Tokens  Cache Rate  Model
optimizer      12,495,459    0%          claude-opus-4.6
tech-lead       7,566,172    0%          claude-opus-4.6
amy             2,749,693    0%          claude-opus-4.6
coach           2,438,618    0%          claude-opus-4.6
scout           2,354,110    0%          claude-opus-4.6
may               923,321    0%          claude-opus-4.6
bob               161,929    52.8%       gemini-3-pro
evaluator         130,073    70.6%       gpt-5.2
qa                292,254    76.8%       gpt-5.2
amy-kimi          132,594    88.4%       kimi-k2.5
```

Effective input rate: $3.00/MTok (Opus via LiteLLM)
Cache read would be: $0.30/MTok (90% discount)

## Action Required

**Single action: Restart PID 7 (the main process)**

This deploys 44+ committed fixes including:
- Prompt caching bypass (7c86665)
- Corrected cron intervals (440bc6a, f8a481c, 4c7cdc3)
- Pre-flight checks (4abbc07)
- Read-dedup guard (9eefa72)
- Evaluator re-eval fix (326b7f2)
- Zombie session cleanup (4c7cdc3)

## Methodology
- Scanned all session meta.json files from last 2 hours
- Extracted cost from session.jsonl usage records
- Verified effective rate ($3.00/MTok) matches individual call costs
- Calculated savings using measured per-session costs × interval correction × cache discount
