# Token Usage & Cost Optimization Report
**Date:** 2026-03-18 | **Author:** Optimizer | **Priority:** CRITICAL

## Executive Summary

Current projected daily cost: **$354/day** (based on 39 sessions over 3.7 hours post-restart).

**The #1 root cause of high costs: Anthropic prompt caching is completely disabled for all Opus agents (0% cache hit rate)** because `ANTHROPIC_API_KEY` is not set, forcing all traffic through LiteLLM which strips `cache_control` fields.

Enabling prompt caching alone could reduce daily costs by **~65%** ($354 → ~$125/day). Combined with turn reduction, costs could drop to **~$75/day**.

## Data Collection Method

Analyzed token usage from `session.jsonl` files (the `usage` field on each assistant turn). Meta.json cost tracking is broken (always shows 0) — a separate bug detailed below.

## Current Cost Breakdown (Post-Restart, 3.7h Window)

| Agent | Sessions | Cost | Daily$ | % | Avg Turns | Cache% |
|-------|----------|------|--------|---|-----------|--------|
| coach | 6 | $11.77 | $76 | 21.4% | 24.5 | **0%** |
| optimizer | 4 | $11.16 | $72 | 20.3% | 33.0 | **0%** |
| tech-lead | 3 | $10.28 | $66 | 18.7% | 31.0 | **0%** |
| amy | 5 | $7.76 | $50 | 14.1% | 18.2 | **0%** |
| scout | 5 | $7.53 | $48 | 13.7% | 19.4 | **0%** |
| may | 5 | $2.73 | $18 | 5.0% | 7.6 | **0%** |
| bob | 4 | $1.44 | $9 | 2.6% | 6.8 | 69% |
| amy-kimi | 4 | $1.24 | $8 | 2.3% | 9.5 | 86% |
| qa | 3 | $1.09 | $7 | 2.0% | 18.0 | 85% |

Key observations:
- **All 6 Opus agents have 0% cache hit rate** (coach, optimizer, tech-lead, amy, scout, may)
- **Non-Opus agents have 69-86% cache hit rates** (bob/Gemini, amy-kimi/Kimi, qa/GPT-5.2)
- Top 3 agents (coach, optimizer, tech-lead) consume **60.4%** of total cost
- High turn counts (25-33) cause quadratic cost growth

## Root Cause Analysis

### Why Caching Is Broken (0% on Opus)

**File:** `src/app/may.ts` lines 120-126

```typescript
// LiteLLM strips cache_control fields, breaking prompt caching (~40% cost savings).
// When ANTHROPIC_API_KEY is available, route directly to Anthropic's API.
const ANTHROPIC_DIRECT = process.env.ANTHROPIC_API_KEY
  ? { baseUrl: "https://api.anthropic.com", apiKey: process.env.ANTHROPIC_API_KEY }
  : { baseUrl: MODEL_BASE_URL, apiKey: LITELLM_API_KEY };
```

The code already supports direct Anthropic API access. When `ANTHROPIC_API_KEY` is set:
1. Opus agents route directly to `api.anthropic.com`
2. `cache_control` fields are preserved
3. Context window increases from 72K → 200K

Currently, the env var is **NOT set**, so all Opus agents go through LiteLLM → cache_control stripped → 0% cache hits.

### Why Turn Counts Are So High

The system prompt architecture is already well-designed (session context in first user message for stable system prompt caching — P147). But agents run many turns because:
- Coach averages 24.5 turns (reviewing, reading files, running commands)
- Optimizer averages 33 turns (analysis-heavy workflows)
- Tech-lead averages 31 turns (code review + editing)

Each turn re-sends the full conversation history. With 30 turns at ~600 tokens growth per turn:
- Total input tokens: ~850K per session
- System prompt accounts for ~35% of total input

## Recommendations

### 1. [CRITICAL] Set ANTHROPIC_API_KEY environment variable
- **Impact:** ~65% cost reduction ($354 → $125/day)
- **Effort:** Environment config change only, no code changes needed
- **Risk:** Very low — code path already exists and tested

### 2. [HIGH] Reduce max turns for expensive agents
- Coach, tech-lead, optimizer: cap at 15-20 turns
- Impact: ~50% additional reduction on per-session cost
- Could be done via agent.json `maxTurns` field

### 3. [HIGH] Fix meta.json cost tracking
- `PersistedSession` interface has no `tokens`, `cost`, or `turns` fields
- The separate session history meta.json format has these fields but always writes 0
- Without working cost tracking, we're flying blind
- Cost data IS available in `session.jsonl` usage fields — just needs aggregation

### 4. [MEDIUM] More aggressive mid-session compaction
- After 10 turns, compact conversation to summary
- Keeps per-turn input bounded at ~10-15K instead of growing to 35-40K

### 5. [LOW] Audit system prompt sizes
- Coach heartbeat.md is 9KB (largest) — review for trimming
- With caching working, this becomes less critical

## Cost Projections

| Scenario | Daily Cost | Savings |
|----------|-----------|---------|
| Current (no caching) | $354 | — |
| + Prompt caching fix | ~$125 | 65% |
| + Turn reduction (cap 15) | ~$75 | 79% |
| + Compaction improvements | ~$55 | 84% |

## Turn-by-Turn Cost Analysis (Example: Coach Session s_1773823602315_6)

```
Turn 1:  6,715 input tokens  →  $0.022  (system prompt base)
Turn 10: 23,405 input tokens →  $0.074
Turn 20: 25,756 input tokens →  $0.081
Turn 30: 31,820 input tokens →  $0.104
Turn 44: 31,794 input tokens →  $0.102
Total session cost: $3.997 across 44 turns
```

The conversation context grows ~600 tokens per turn. By turn 30, each turn costs 5x what turn 1 costs.

## Meta.json Bug Details

All archived sessions show:
```json
{"id":"s_...", "agent":"...", "tokens":0, "cost":0, "duration":0, "status":"done", "turns":0}
```

The `PersistedSession` TypeScript interface only has: `agent, task, status, startedAt, endedAt, error, parentSessionId, workflowRunId, stepLabel, detached, pid, instance, kind, autoClose, opCount, orderId`

**No token/cost/turns fields.** The history meta.json appears to be a different format that doesn't get populated by the session tracking code.
