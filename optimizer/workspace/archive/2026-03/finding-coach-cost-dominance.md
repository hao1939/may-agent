# Finding: Coach Cost Dominance — $192/day (37% of total)

**Date:** 2026-03-18T16:19 UTC
**Severity:** HIGH — coach alone costs more than the next two agents combined
**Status:** Analysis complete, fixes proposed

## Data (8h window, 96 sessions total)

### System-wide cost breakdown
| Agent | Cost (8h) | Daily projected | % of total |
|-------|-----------|-----------------|------------|
| coach | $63.82 | $192 | 37.4% |
| tech-lead | $34.87 | $105 | 20.4% |
| optimizer | $28.88 | $87 | 16.9% |
| amy | $15.63 | $47 | 9.1% |
| scout | $10.37 | $31 | 6.1% |
| may | $5.78 | $17 | 3.4% |
| bob | $4.52 | $14 | 2.6% |
| amy-kimi | $2.37 | $7 | 1.4% |
| evaluator | $2.31 | $7 | 1.4% |
| qa | $2.28 | $7 | 1.3% |
| **TOTAL** | **$170.83** | **$513** | |

### Coach session breakdown (23 sessions in 8h)
| Category | Count | Cost | Avg cost | Input tokens |
|----------|-------|------|----------|-------------|
| Heartbeat | 10 | $31.41 | $3.14 | 10.0M |
| common-sense-verify | 2 | $6.78 | $3.39 | 2.2M |
| sprint:execute | 1 | $5.93 | $5.93 | 1.9M |
| growth-cycle:test | 2 | $5.07 | $2.54 | 1.6M |
| growth-cycle:diagnose | 1 | $3.53 | $3.53 | 1.1M |
| growth-cycle:fork | 1 | $3.51 | $3.51 | 1.1M |
| research-intake | 1 | $2.40 | $2.40 | 756K |
| sprint:record | 1 | $1.93 | $1.93 | 622K |
| growth-cycle:record | 1 | $1.51 | $1.51 | 489K |
| reflect | 1 | $1.25 | $1.25 | 379K |
| sprint:test | 1 | $0.49 | $0.49 | 143K |
| sprint trigger | 1 | $0.02 | — | 6K |

### Heartbeat bimodality
- 4 "expensive" heartbeats: $3.29-$7.04 each (29-64 LLM calls) — doing deep experiments
- 6 "cheap" heartbeats: $0.11-$0.76 each (4-14 calls) — quick check-and-dispatch

## Root Causes

### 1. Heartbeats are unbounded work sessions ($31.41, 49% of coach cost)
The heartbeat.md says "🔴 NEVER IDLE — ALWAYS EXPLORE" and "run at least one gym experiment per heartbeat." This turns every heartbeat into a deep open-ended exploration session. Some heartbeats used 62+ LLM calls, reading dozens of files and building new gym scenarios.

**Fix:** Cap coach heartbeats at 15 LLM turns. The heartbeat should DISPATCH to workflows (growth-cycle, training-sprint), not DO the work inline. Any experiment work that needs >15 turns should be queued as a workflow, not done in the heartbeat.

### 2. Zero prompt cache hits (cacheRead=0 everywhere)
Every LLM call sends the full system prompt + conversation history without caching. With 311 LLM calls across coach heartbeats alone (10M input tokens), even 50% cache hit rate would save ~$10/8h = $30/day.

**Fix:** This requires ANTHROPIC_API_KEY env var to be set (already tracked, awaiting Hao).

### 3. Workflow sessions have excessive turns
- "Execute all forks" (sprint): 57 LLM calls, $5.93 — reading many files repeatedly
- "Plan a training sprint": 117 JSONL messages, $4.82

**Fix:** Workflow step prompts should include "complete in ≤20 turns" budget.

### 4. common-sense-verify still expensive ($3.39/run)
Despite cron message update to instruct grep-based search, each run still costs $3.39 (2x daily = $6.78/8h). The cron message change may not have taken effect yet, or the agent is ignoring the instruction.

**Fix:** Verify the cron message is being used. Consider converting to a JS handler (the pattern matching is mechanical enough).

## Proposed Fixes (ordered by impact)

### Fix 1: Cap coach heartbeat turns [est. savings: $15-20/day]
Add to coach heartbeat.md: "Budget: ≤15 tool calls per heartbeat. If you need more, dispatch to a workflow." The 4 expensive heartbeats ($19.14) would become $3-4 each = ~$12-16 total, saving ~$7/8h.

### Fix 2: Cap workflow step turns [est. savings: $5-10/day]
Add turn budgets to workflow step prompts. Sprint:execute should be ≤25 turns, not 57.

### Fix 3: Reduce coach heartbeat frequency [est. savings: $10-15/day]
Coach fires 10 heartbeats in 8h (~every 48min). With dedicated crons for training-sprint, common-sense-verify, reflect, and research-intake, the heartbeat's only unique job is error-driven growth. Could fire every 60-90min instead of 30min.

### Fix 4: Convert common-sense-verify to JS handler [est. savings: $6-7/day]
Pure pattern matching — search for behavioral violations in session transcripts using grep/regex, then report. No LLM needed.

## Total potential savings: $36-52/day ($1,080-1,560/month)
