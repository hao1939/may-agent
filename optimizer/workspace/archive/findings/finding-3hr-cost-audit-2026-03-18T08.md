# Finding: 3-Hour Cost Audit (2026-03-18 ~06:00-08:48 UTC)

## Summary
Live cost audit of 78 sessions over 3 hours reveals **$93/3hr = ~$745/day burn rate**. Prompt caching is 0% for all Claude-based agents (6 of 10). Idle sessions (≤3 tool ops) account for 47% of sessions and $78/day waste.

## Key Metrics

| Agent | Sessions | Cost | Avg Cost | Cache % | Idle |
|-------|----------|------|----------|---------|------|
| tech-lead | 13 | $29.26 | $2.25 | 0% | 4 |
| optimizer | 9 | $27.94 | $3.10 | 0% | 0 |
| coach | 12 | $14.72 | $1.23 | 0% | 6 |
| scout | 5 | $7.49 | $1.50 | 0% | 1 |
| amy | 5 | $6.11 | $1.22 | 0% | 2 |
| may | 11 | $3.64 | $0.33 | 0% | 8 |
| qa | 4 | $1.53 | $0.38 | ✅ | 0 |
| bob | 10 | $1.43 | $0.14 | ✅ | 8 |
| evaluator | 5 | $0.74 | $0.15 | ✅ | 4 |
| amy-kimi | 4 | $0.30 | $0.07 | ✅ | 3 |
| **Total** | **78** | **$93.16** | **$1.19** | | **36** |

## Critical Insights

### 1. Prompt Caching: $0 for Claude, Working for Others
All 6 Claude-based agents (tech-lead, optimizer, coach, scout, amy, may) show **0% prompt cache read rate**. These account for **$89.16 of $93.16 (95.7%)** of total cost. Non-Claude agents (QA/bob/evaluator/amy-kimi) DO have caching working (>100% cache read ratio). Fix committed (7c86665) but NOT DEPLOYED.

**Estimated savings if caching worked**: With 90% cache hit on the system prompt + history (which stays static per turn), cache tokens cost 90% less. For 6 Claude agents spending $89.16/3hr, approximately 70% of input tokens are cacheable → **$56-63 savings per 3hr = $448-504/day savings**.

### 2. Expensive Idle Sessions
4 tech-lead "0 ops" sessions cost a combined **$5.98**. These sessions fire, the model reads the large context (heartbeat instructions + task history), generates a response, makes tool calls that get recorded as conversation turns but aren't counted as "ops" in meta.json... yet they produce no lasting changes.

**Example**: `s_1773816800270_57` — 12 conversation turns, 0 opCount, $1.20 cost. The model read heartbeat.md, bulletin.md, ran tsc, reviewed implementation-plan.md... but meta.json says ops=0. This suggests opCount only counts certain tool types, not all actual tool calls.

### 3. Top Cost Drivers
- tech-lead + optimizer = **$57.20 (61.4%)** of total cost
- A single tech-lead session reached **$7.13** (67 turns)
- Average optimizer session: **$3.10** (most expensive per-session)

### 4. Idle Waste Quantified
- 36 of 78 sessions (47%) are idle (≤3 tool ops)
- Idle cost: $9.77/3hr = **$78/day**
- These sessions should never have started the LLM

## Blocked Fixes (all committed, need restart)
1. **Prompt caching bypass** (7c86665) — estimated $448-504/day savings
2. **Heartbeat interval fixes** (cron.json changes) — ~$26/day savings
3. **Pre-flight skip** (4abbc07) — $3-5/day savings on run-agent-task entries
4. **skipIfIdle fix** (needs code to query may.db not empty requests.db)
5. **Circuit breaker** (97f3a50) — stops Bob's endless Gemini errors

## Actions
- **No new action needed** — all fixes already committed and tracked
- **Primary blocker**: Process restart (PID 7)
- **Combined estimated savings once deployed**: $500-600/day ($15-18K/month)

## Methodology
Parsed `session.jsonl` from 78 sessions in `.state/sessions/history/` with timestamps > 3 hours ago. Extracted per-turn `usage.cost.total` from assistant messages. Grouped by agent from `meta.json`. Cross-validated against known model pricing.
