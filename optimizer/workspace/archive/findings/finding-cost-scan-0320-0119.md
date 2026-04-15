# Cost Scan — 2026-03-20T01:19Z

## Metrics (last ~2 hours, 23:19–01:05 UTC)
- **18 sessions**, 2,532KB total (141KB avg)
- **Error rate: 16.7%** (3/18) — 2 Bob API errors (Gemini), 1 evaluator OpBudget
- **Sessions/hr: 9.0** — healthy volume (down from prior peak of ~37.5/hr)

## Agent Cost Breakdown (actual $ from session.jsonl)

| Agent | Sessions | Total Cost | Avg/Session | % of Total |
|-------|----------|-----------|-------------|------------|
| optimizer | 2 | $11.89 | $5.94 | 48.1% |
| coach | 4 | $5.85 | $1.46 | 23.7% |
| tech-lead | 2 | $4.23 | $2.12 | 17.1% |
| amy-kimi | 2 | $1.01 | $0.51 | 4.1% |
| bob | 3 | $0.87 | $0.29 | 3.5% |
| qa | 1 | $0.36 | $0.36 | 1.5% |
| scout | 2 | $0.27 | $0.14 | 1.1% |
| evaluator | 1 | $0.19 | $0.19 | 0.8% |
| may | 1 | $0.05 | $0.05 | 0.2% |
| **TOTAL** | **18** | **$24.72** | **$1.37** | **100%** |

Hourly rate: **$12.36/hr** → **$297/day** extrapolated

## Key Findings

### 1. 🔴 CRITICAL: Prompt caching still broken — 0% cache rate on Opus
All 4 most expensive sessions use Claude Opus with **0% cache read rate**.
- optimizer s_91: $6.67 (50 turns, 0% cached) — would be ~$2.33 with 65% cache
- optimizer s_95: $5.22 (49 turns, 0% cached) — would be ~$1.83 with 65% cache
- coach s_104: $3.35 (23 ops, 0% cached) — would be ~$1.17 with 65% cache
- tech-lead s_105: $3.45 (47 ops, 0% cached) — would be ~$1.21 with 65% cache

**Total Opus cost this window: $21.97 (89% of all cost)**
**With caching at 65%: ~$7.69 → savings $14.28/window ($171/day)**

Code fix exists (commit 7c86665) but needs `ANTHROPIC_API_KEY` env var.
**This is the single largest optimization opportunity: ~$171/day ($5,100/month).**

### 2. 🟡 Evaluator opBudget=5 too low for heartbeats
Two evaluator heartbeat sessions (s_39 and s_103) hit `OpBudgetExceeded` at 5 ops.
Evaluator heartbeat tries to: read heartbeat.md, read periodic-tasks.md, read consistency-flags.jsonl, read human-reviews.jsonl, read re-evaluations.jsonl → already 5 reads on turn 1 alone.
Wasted: $0.19/session × ~2 heartbeats/day = $0.38/day.
**Fix: Increase evaluator opBudget to 15-20 for heartbeat tasks, or add opBudget override per task type.**

### 3. 🟡 Bob Gemini API instability causes retry waste
Sessions 106 and 107 both failed with Gemini API errors (streaming error, empty response).
Only session 108 succeeded. Total waste: $0.29 for zero-value sessions.
**Fix: Already deployed circuit breaker (97f3a50). Gemini is just unreliable — consider model fallback.**

### 4. 🟢 Coach cost dramatically reduced (ongoing success)
Coach avg dropped from $3.45/session (pre-turn-budget) to $1.46/session now (58% reduction).
Session 104 (common-sense-verify at $3.35) is the exception — it does legitimate deep verification work.
**No further action needed** — the turn budget optimization is working.

### 5. 🟢 Session volume healthy
9 sessions/hr is appropriate for 9 active agents at 30min intervals.
May handler sessions are very lean ($0.05). Scout early-exit working ($0.14/session).

## Error Details
| Session | Agent | Error | Waste |
|---------|-------|-------|-------|
| s_106 | bob | Gemini streaming error | $0.06 |
| s_107 | bob | Empty response (0 tokens) | $0.23 |
| s_103 | evaluator | OpBudgetExceeded (5 limit) | $0.19 |
| **Total error waste** | | | **$0.48** |

## Actions
- [ ] **Prompt caching env var** — Still blocked on ANTHROPIC_API_KEY (req to Hao). Est: $171/day savings.
- [ ] **Evaluator opBudget** — Send request to increase to 15 for heartbeats.
- [ ] No new code changes needed — existing optimizations working well.

## Comparison to Previous Scan (2026-03-19T23:20)
- Session volume: 38/4h → 9/hr (consistent)
- Error rate: 2.6% → 16.7% (Bob API instability spike, transient)
- Coach avg: 158KB → 175KB (stable)
- Overall cost: $297/day extrapolated (dominated by 0% cache on Opus)
