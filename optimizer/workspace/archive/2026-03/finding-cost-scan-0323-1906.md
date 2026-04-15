# Cost Scan — 2026-03-23T19:06

## Window: 60 sessions over 8.3 hours (10:49 – 19:06 UTC)

### Session Rate
- **7.2 sessions/hr** → 173 projected/day
- Trending DOWN: 10.0/hr (6-8h ago) → 9.0 → 5.5 → 5.5/hr (recent 2h)
- This is a 47% improvement from the 13.3/hr measured at 12:06 scan

### Estimated Cost: ~$277/day (based on transcript sizes @ $0.012/KB)

| Agent | Sessions | Total KB | Avg KB/s | Est Cost | % Cost |
|-------|----------|----------|----------|----------|--------|
| optimizer | 15 | 2,449 | 163 | $29.39 | 30.6% |
| coach | 12 | 2,167 | 181 | $26.00 | 27.1% |
| bob | 7 | 1,011 | 144 | $12.13 | 12.6% |
| tech-lead | 5 | 994 | 199 | $11.93 | 12.4% |
| scout | 3 | 651 | 217 | $7.81 | 8.1% |
| qa | 7 | 425 | 61 | $5.10 | 5.3% |
| may | 8 | 219 | 27 | $2.62 | 2.7% |
| evaluator | 1 | 46 | 46 | $0.55 | 0.6% |
| coder | 2 | 42 | 21 | $0.51 | 0.5% |
| **TOTAL** | **60** | **8,004** | | **$96.05** | |

### Key Findings

#### 1. Optimizer cost shifting from heartbeats → skill-lifecycle (POSITIVE TREND)
- All 15 optimizer sessions are skill-lifecycle workflow phases (0 heartbeats!)
- Cooldown is working: prevented unnecessary heartbeat runs
- In most recent 2h window: only 1 optimizer session (159KB) — down from 50% of cost
- **Skill-lifecycle 6h cooldown successfully reduced optimizer's rate**

#### 2. Coach is now the #1 cost driver in recent window
- Last 2h: coach = 4 sessions, 735KB (47% of recent cost)
- Coach session s_72: 456KB with 102KB largest tool result
- Root cause: 35 bash calls including grep on session.jsonl producing massive outputs
- session-read-guard blocks `read()` but NOT `bash`+`grep` of session.jsonl
- **Action needed: Coach's bash grep on session files bypasses the session-read-guard**

#### 3. Handler health: ALL handlers still dead (binary stale)
- Binary rebuilt Mar 20 (may-agent-97a3754)
- 15/17 handler TS files modified after binary build (Mar 23)
- Bun SEA can't dynamically import from filesystem — handlers baked in at compile time
- All output artifacts MISSING: heartbeat-context.md, qa-gate-results.json, system-status.md, daily-brief.md, coaching-report.md
- **Binary rebuild remains the single biggest infrastructure blocker**
- Estimated impact: $10-25/day savings from working handlers (convention-check, tool-quality-scan, heartbeat-context would reduce redundant LLM work)

#### 4. Scout outlier: 524KB session (9 scrape_webpage calls)
- Legitimate research work but extremely expensive single session
- 22 bash + 12 read + 9 scrape_webpage = 43 tool calls
- Scout only has 3 sessions/8h (low rate) but high per-session cost (217 KB avg)

#### 5. ANTHROPIC_API_KEY still unset → prompt caching 0%
- Every session pays full price for context tokens
- With caching: 90% reduction on cached tokens = ~$36-90/day savings
- This remains the single biggest cost-reduction opportunity

### Trend vs Previous Scans

| Metric | 12:06 scan | 17:36 scan | 19:06 scan | Trend |
|--------|-----------|-----------|-----------|-------|
| Sessions/hr | 13.3 | 7.5 | 7.2 | ↓ good |
| Optimizer % | 34.4% | 22.5%(2h) | 30.6%(8h) | ↓ improving |
| Coach % | - | 78 ops/2h | 27.1%(8h) | ← concern |
| Session rate | declining | declining | declining | ✅ |

### Top 3 Savings Opportunities (ranked by impact)
1. **ANTHROPIC_API_KEY** → $36-90/day (requires env var set)
2. **Binary rebuild** → $10-25/day (enables all JS handlers)
3. **Coach bash-grep guard** → $5-10/day (session.jsonl via bash still unguarded)
