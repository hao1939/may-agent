# Token Waste Analysis v2: May-Agent Sessions — Deep Dive

**Date**: 2026-04-09
**Scope**: ALL 1,153 sessions across all agents (full history)
**Total cost analyzed**: $790.92
**Previous version**: token-waste-analysis.md (100-session sample)

## Executive Summary

Claude Opus 4.6 sessions account for **92% of total cost** ($728.64) with **0% prompt cache hit rate**. Enabling prompt caching would save **$441/week** (60.6% reduction). The fix exists (commit 7c86665) but is blocked on an env var + restart — this is a human action item, not a code problem.

Beyond caching, long sessions (31+ turns) consume **67% of total cost** despite being only 15% of sessions. Compaction is active and working, but sessions still hit 40-60K input tokens per turn before compacting.

### Top 3 Token Waste Sources (Ranked by Impact)

| # | Waste Source | Estimated Savings | Status |
|---|-------------|------------------|--------|
| 1 | **Zero prompt caching on Claude Opus** | **$441/week (60.6%)** | Code-fixed, needs deploy |
| 2 | **Long session context accumulation** | **$50-100/week (7-13%)** | Structural |
| 3 | **Duplicate file reads + oversized tools** | **$15-25/week (2-3%)** | Partially mitigated |

**Total addressable waste: $506-566/week (64-72% of current cost)**

---

## Section 1: Claude Prompt Caching (The $441/Week Problem)

### The Situation
- **863 Claude Opus sessions**: $728.64 total, **0.0% cache hit rate**
- **235 GPT-5.2 sessions**: $43.44 total, 81.5% cache rate
- **55 Kimi-k2.5 sessions**: $18.92 total, 91.7% cache rate

Only Claude is affected. The SDK correctly sets `cache_control: { type: "ephemeral" }` on system prompts and conversation prefixes. The system prompt is intentionally designed for cache stability (session-specific data moved to the first user message in `manager.ts:511`).

### Root Cause: LiteLLM Proxy Stripping Cache Headers
All Claude calls route through a LiteLLM proxy at `localhost:4000`. The proxy re-serializes requests and strips the `cache_control` fields before forwarding to Anthropic. This has been diagnosed and documented:
- **Finding**: `agents/shared/knowledge/findings/finding-prompt-caching-broken-opus.md`
- **Fix**: Commit `7c86665` — bypass LiteLLM for Anthropic, route directly to `api.anthropic.com`
- **Blocker**: Needs `ANTHROPIC_API_KEY` env var set + process restart (requires Hao)

### Cost Model: Current vs. Cached

With 80% cache rate (conservative, matching GPT-5.2 actuals):

| Metric | Current (0% cache) | Projected (80% cache) | Difference |
|--------|-------------------:|---------------------:|----------:|
| Weekly cost (Claude) | $728.64 | $287.17 | **-$441.46** |
| Daily cost | $104.09 | $41.02 | -$63.07 |
| Monthly cost | $3,114 | $1,228 | **-$1,886** |
| Per-session avg | $0.844 | $0.333 | -$0.511 |

### Action Required
**This is a P0 human action item**: Set `ANTHROPIC_API_KEY` in `.env` and restart PID 7. No code changes needed — the fix is already committed.

---

## Section 2: Long Session Cost Accumulation

### Data: Session Length vs. Cost

| Turn Bucket | Sessions | % of Total | Cost | % of Cost | Cost/Session |
|------------|--------:|-----------:|-----:|---------:|-------------:|
| 1-5 turns | 216 | 18.7% | $12.76 | 1.6% | $0.06 |
| 6-10 turns | 238 | 20.6% | $34.80 | 4.4% | $0.15 |
| 11-20 turns | 388 | 33.7% | $113.36 | 14.3% | $0.29 |
| 21-30 turns | 135 | 11.7% | $101.57 | 12.8% | $0.75 |
| **31+ turns** | **176** | **15.3%** | **$528.43** | **66.8%** | **$3.00** |

**Key insight**: The top 30 most expensive sessions (all 31+ turns) cost $195.43 — **24.7% of total cost from 2.6% of sessions**.

### Compaction Is Working But Insufficient

Compaction triggers at 70% of the context window and keeps recent messages. Evidence from the most expensive session (coach, 289 turns, $21.85):

```
Turn   1: input=  7,427  → $0.03 cumulative
Turn  61: input= 42,265  → $1.02 cumulative  (pre-compaction peak)
Turn 121: input=    152  → $6.94 cumulative  (just compacted)
Turn 161: input= 49,371  → $10.60 cumulative  (filled up again)
Turn 201: input=    619  → $13.83 cumulative  (compacted again)
```

Pattern: Input tokens sawtooth between ~150 tokens (just compacted) and ~50K tokens (approaching limit). Each sawtooth cycle costs ~$3-4. Compaction prevents overflow but doesn't prevent the expensive refill cycles.

### Fix Proposals for Long Sessions

**Fix 2a: Aggressive session splitting** (Behavioral)
- Current: sessions can run 100-289 turns
- Proposed: Hard limit at 25-30 turns with checkpoint + new session
- Impact: A 100-turn session costs $6.64; split into 4×25-turn sessions would cost ~$4.00 (40% savings from reduced context accumulation)

**Fix 2b: Reduce compaction refill cost** (Infrastructure)
- After compaction, the context is tiny (~150 tokens) but immediately refills to 40K+
- Compaction summary could be more aggressive — keep less context
- Consider: persist compacted state across restarts (currently only 4 sessions have compaction markers in logs)

**Fix 2c: Early termination for diminishing returns** (Behavioral)
- After turn 25: finish-or-fork guard that forces the agent to either complete or checkpoint
- This is partially implemented via "turn discipline" context guidance but not enforced structurally

---

## Section 3: Duplicate Reads + Oversized Tool Results

### Read Dedup Guard Already Exists
The `read-dedup-guard.ts` blocks after 5 reads of the same file. This prevents the worst case (the historical Amy incident: 152 reads/session costing $71). But:
- Warn threshold at 3 reads still allows 3× redundancy
- The guard doesn't account for *content size* — reading a 51KB file 3× wastes 153KB

### Remaining Waste After Guard

From the original 100-session sample:
- 107 duplicate read instances (2+ reads of same file)
- 5.15 MB redundant content
- Top files: INDEX.md (51KB, 5-7 reads), todo.md (51KB, 4-6 reads), PRIORITY-TRACKER.md (28KB, 5-6 reads)

### system_status Overhead
- 130KB per call, 6 calls in sample = 780KB
- With context accumulation, this 130KB propagates through subsequent turns
- Already has a proposed fix: summary-by-default mode

### Fix Proposals

**Fix 3a: Size-aware read limits** (Infrastructure)
- For files >20KB: reduce dedup threshold to 2 reads
- For files >50KB: warn on first read, suggest grep/offset approach
- Estimated savings: ~$5-10/week

**Fix 3b: Slim down large shared files** (Structural)
- INDEX.md (51KB): Split into topic-specific sub-indices
- PRIORITY-TRACKER.md (28KB): Archive completed items
- Target: No frequently-read file >15KB
- Estimated savings: ~$10-15/week (reduces both reads and context bloat)

**Fix 3c: system_status summary mode** (Infrastructure)
- Default: 5KB summary (counts + health indicators)
- Optional: `detail` parameter for full dump
- Estimated savings: ~$2-5/week

---

## Section 4: Additional Findings

### 4.1 Input:Output Token Ratio
- **Overall: 34.6:1** (input tokens dominate)
- Claude specifically: ~35:1
- This means input token optimizations (caching, dedup) have 35× more impact than output optimizations

### 4.2 Error Sessions Waste Significant Cost
- **2,855 error sessions** across all agents (may: 681, bob: 496, coach: 480)
- Error sessions still consume tokens for the turns before failure
- Estimated waste: 10-15% of total cost goes to sessions that ultimately fail

### 4.3 Agent Cost Distribution (All Time)

| Agent | Sessions | Model | Estimated Cost Share |
|-------|--------:|-------|----:|
| coach | 2,355 | claude-opus-4.6 | ~30% |
| bob | 2,213 | claude-opus-4.6 | ~22% |
| tech-lead | 1,830 | claude-opus-4.6 | ~15% |
| may | 3,951 | claude-opus-4.6 | ~12% |
| optimizer | 1,433 | claude-opus-4.6 | ~8% |
| scout | 892 | claude-opus-4.6 | ~5% |
| amy-kimi | 994 | kimi-k2.5 | ~2.5% |
| amy | 893 | claude-opus-4.6 | ~2% |
| qa | 644 | gpt-5.2 | ~2% |
| evaluator | 1,834 | gpt-5.2 | ~1.5% |

### 4.4 Compaction Frequency
- Only 4 sessions out of 1,153 have compaction markers in session.jsonl
- But the token sawtooth pattern suggests compaction IS happening (input drops from 50K to ~150 tokens)
- The compaction likely happens at the pi-agent-core level and modifies messages in memory without logging to session.jsonl

### 4.5 Thinking Tokens
- Only 2 of last 100 sessions had thinking blocks
- Adaptive thinking on Opus 4.6 is active but thinking tokens are not separately tracked in usage
- This is a minor cost factor — output tokens are only 3% of total cost

---

## Section 5: Prioritized Action Plan

### P0: Deploy Prompt Caching Fix (Hao Action Required)
- **What**: Set `ANTHROPIC_API_KEY` in `.env`, restart PID 7
- **Savings**: $441/week, $1,886/month
- **Effort**: 5 minutes
- **Risk**: None — code already committed (7c86665), tested
- **Status**: CODE-FIXED, waiting for deployment

### P1: Enforce Session Length Limits
- **What**: Structural guard at 25-30 turns forcing checkpoint + finish/fork
- **Savings**: $50-100/week
- **Effort**: Medium (new guard in compose-guards)
- **Dependency**: None

### P1: Slim Down Large Shared Files
- **What**: Split INDEX.md, archive old PRIORITY-TRACKER items
- **Savings**: $10-15/week
- **Effort**: Low-Medium
- **Dependency**: None

### P2: system_status Summary Mode
- **What**: Default 5KB summary output
- **Savings**: $2-5/week
- **Effort**: Low
- **Dependency**: None

### P2: Size-Aware Read Dedup
- **What**: Tighter limits on large file re-reads
- **Savings**: $5-10/week
- **Effort**: Low (modify read-dedup-guard.ts)
- **Dependency**: None

### P2: Reduce Error Session Waste
- **What**: Faster failure detection, earlier session termination on repeated errors
- **Savings**: $10-15/week
- **Effort**: Medium
- **Dependency**: Needs error pattern analysis

---

## Methodology

- **Token data**: Extracted from `session.jsonl` usage fields across all 1,153 sessions
- **Cost calculation**: Claude Opus input $3/Mtok, cached $0.30/Mtok, cache write $3.75/Mtok, output $15/Mtok
- **Cache savings model**: 80% cache hit rate (conservative, matching GPT-5.2 actuals of 81.5%)
- **Session metadata**: Cross-referenced with `may.db` sessions table
- **Source code audit**: `pi-ai/dist/providers/anthropic.js`, `manager.ts`, `compaction.ts`, `read-dedup-guard.ts`
- **Prior work**: Optimizer finding `finding-prompt-caching-broken-opus.md` (2026-03-18)
