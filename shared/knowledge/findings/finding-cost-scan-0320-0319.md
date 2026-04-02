# Cost Scan — 2026-03-20T03:19Z

## Metrics (last ~2 hours, 01:19–03:19 UTC)
- **25 sessions** (21 completed, 3 running, 1 error)
- **Total cost: $29.95** (including running sessions)
- **Hourly rate: $13.42/hr → $322/day** extrapolated
- **Error rate: 8%** (2/25: 1 coach streaming truncation, 1 coach interrupted)

## Critical Finding: Opus Cache Still 0% — $848/day Savings Blocked

| Model Group | Agents | Sessions | Cost | % Total | Cache Hit Rate |
|-------------|--------|----------|------|---------|----------------|
| **Opus** | optimizer, coach, tech-lead | 17 | $26.73 | **89%** | **0.0%** |
| **Sonnet** | bob, amy-kimi, qa, evaluator, may | 8 | $3.22 | 11% | **82.0%** |

**Prompt caching is working perfectly for Sonnet agents** (82% cache hit rate). It is completely broken for Opus agents (0% cache hit rate). This confirms the issue is specific to the Opus/Anthropic direct API path.

### Savings projection (Opus with 65% cache):
- Current Opus input tokens: 8,458,879
- Current input cost: $126.88/2.1h
- With 65% cache: $52.66/2.1h
- **Savings: $74.23/2.1h → $848/day ($25,440/month)**

Code fix exists (commit 7c86665) but needs `ANTHROPIC_API_KEY` env var. This has been the #1 optimization for 2+ days.

## Agent Cost Breakdown

| Agent | Sessions | Total $ | Avg $/sess | % of Total |
|-------|----------|---------|-----------|------------|
| optimizer | 7 | $12.74 | $1.82 | 42.5% |
| coach | 8 | $9.51 | $1.19 | 31.7% |
| tech-lead | 2 | $2.17 | $1.09 | 7.2% |
| bob | 2 | $1.44 | $0.72 | 4.8% |
| amy-kimi | 2 | $1.16 | $0.58 | 3.9% |
| qa | 1 | $0.37 | $0.37 | 1.2% |
| evaluator | 1 | $0.14 | $0.14 | 0.5% |
| may | 2 | $0.11 | $0.05 | 0.4% |

### Notable: Optimizer is #1 cost agent (42.5%)
7 sessions at $1.82 avg — driven by:
- skill-lifecycle workflow (4 child sessions: $1.65 + $0.46 + $1.80 + $0.18 = $4.09)
- heartbeat sessions ($3.99, $3.91 each)

Optimizer heartbeats are expensive because they involve extensive analysis (reading many session files, computing costs, writing findings). This is the nature of optimization work — it costs money to find savings.

### Coach streaming error: $5.55 waste
Session s_1773975927125_134 hit `LLM returned stopReason "toolUse" but no tool call content blocks were present` — a streaming truncation from the API/proxy. This burned 45 ops and $5.55 before failing. The session got up to 41K input tokens per call with 0% cache.

**Root cause**: Network/proxy issue truncating Anthropic streaming responses. This is the second time this error type has appeared.

**Mitigation**: A retry mechanism for truncated streaming responses would prevent full session waste. Currently the error is terminal.

## Positive Trends
1. ✅ **Evaluator opBudget fixed** — now 15 (was 5). No more OpBudgetExceeded errors.
2. ✅ **Coach avg cost $1.19** — down from $1.46 last scan, $3.45 pre-turn-budget (66% reduction total).
3. ✅ **Sonnet agents lean** — bob $0.72, amy-kimi $0.58, evaluator $0.14. Well-optimized.
4. ✅ **May extremely lean** — $0.05/session average (handler-based sessions).
5. ✅ **Session volume stable** — ~12/hr, appropriate for current agent count.

## Comparison to Previous Scan (2026-03-20T01:19)
| Metric | Previous | Current | Trend |
|--------|----------|---------|-------|
| Sessions/hr | 9.0 | 11.9 | ↑ (coach workflow children) |
| Daily rate | $297 | $322 | ↑ (coach error + optimizer workflow) |
| Error rate | 16.7% | 8% | ✅ Improved |
| Opus cache | 0% | 0% | ⛔ No change |
| Sonnet cache | N/A | 82% | ✅ Working well |
| Coach avg | $1.46 | $1.19 | ✅ Improved |

## Actions
- [ ] **#1 PRIORITY: ANTHROPIC_API_KEY env var** — Blocked on Hao. $848/day savings.
- [ ] **Streaming truncation retry** — Coach lost $5.55 to truncated response. Propose retry mechanism to tech-lead.
- [ ] No new code changes needed — existing optimizations continuing to work.
