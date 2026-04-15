# Cost Outlier Scan — 2026-03-16

## Summary
**200 sessions analyzed** (1.8-hour window: 13:57–15:43 UTC 2026-03-16)

| Metric | Value | Vs. Last Scan (Mar 15) |
|--------|-------|------------------------|
| Total cost | $173.29 | — |
| Average/session | $0.85 | ↓ from $1.12 (24% reduction) |
| Outlier rate (>$2) | 8.0% (16 sessions) | ↓ from 14.9% (almost halved) |
| Error rate | 29.5% (58 sessions) | ↑ from ~13.6% |
| Error cost | $56.25 (32.5% of total) | ⚠️ Significant waste |

## Key Finding: 429 Rate Limits Are 73% of All Errors

### Error Distribution
| Error Type | Sessions | Wasted Cost | Avg Cost |
|-----------|----------|-------------|----------|
| **429 rate limit** | 41 (71%) | $42.25 | $1.03 |
| JSON parse | 2 (3%) | $9.08 | $4.54 |
| Shallow heartbeat | 2 (3%) | $0.37 | $0.19 |
| Cannot continue | 3 (5%) | $0.00 | $0.00 |
| Other | 10 (17%) | $4.55 | $0.45 |

### 429 Errors Are Accelerating
- 13:xx UTC: 5 errors
- 14:xx UTC: 17 errors  
- 15:xx UTC: 19 errors

### Most Affected Agents
| Agent | Total Errors | 429 Errors | Error Rate |
|-------|-------------|------------|-----------|
| Bob | 20 | 14 | 76% |
| Tech-Lead | 9 | 7 | 32% |
| Coach | 9 | 7 | 60% |
| Optimizer | 7 | 7 | 58% |
| May | 7 | 5 | 15% |
| Scout | 5 | 4 | 56% |

## Fixes Applied This Session

### Already Deployed (committed 15:34 UTC)
- **Differential backoff** in `src/lib/manager-retry.ts`: rate limit errors now use 15s base delay with sequence 15s→30s→60s→120s→240s, vs 1s→2s→4s for stream errors.
- **JSON parse error retry** (Pattern 4): auto-retries stream corruption errors.
- **Impact**: Not yet reflected in data — deployed minutes before this scan.

### Recommended (not yet implemented)
1. **Cron stagger**: Multiple agents fire cron jobs simultaneously → burst of API requests → 429 cascade. Adding 30-60s random jitter to cron start times would spread load.
2. **Reduce cron frequency for high-error agents**: Coach (60% error rate) and Scout (56% error rate) are wasting sessions. Consider increasing their interval during peak hours.
3. **Prompt caching**: ALL Opus agents at 0% cache rate. This is the #1 remaining cost lever (estimated 50%+ savings on input tokens). Blocked on LiteLLM proxy config change (Hao).

## Outlier Sessions (>$2.00)
| Cost | Agent | Turns | Duration | Status |
|------|-------|-------|----------|--------|
| $5.42 | tech-lead | 49 | 538s | ERR |
| $5.20 | coach | 50 | 2197s | OK |
| $4.68 | optimizer | 45 | 571s | OK |
| $4.02 | coach | 42 | 543s | OK |
| $3.88 | optimizer | 36 | 472s | OK |
| $3.85 | coach | 42 | 988s | ERR |
| $3.70 | tech-lead | 46 | 574s | OK |
| $3.65 | may | 41 | 1294s | ERR |
| $3.46 | optimizer | 46 | 2410s | OK |
| $2.91 | coach | 35 | 559s | ERR |
| $2.49 | scout | 37 | 1901s | OK |
| $2.35 | scout | 28 | 690s | ERR |
| $2.33 | optimizer | 26 | 667s | ERR |
| $2.24 | amy-kimi | 31 | 524s | OK |
| $2.16 | bob | 44 | 863s | OK |

### Pattern: Top outliers are ALL heartbeat sessions with 35-50 turns
These are long heartbeats doing legitimate work (analysis, coding, investigating). Compaction helps limit their ceiling cost. No action needed on the outlier sessions themselves — the issue is error waste, not successful session cost.

## Agent Cost Breakdown
| Agent | Total | Sessions | Avg/Session | Error Rate | Cache |
|-------|-------|----------|-------------|-----------|-------|
| May | $34.77 | 48 | $0.72 | 15% | 0% |
| Coach | $28.49 | 15 | $1.90 | 60% | 0% |
| Tech-Lead | $26.44 | 28 | $0.94 | 32% | 0% |
| Optimizer | $23.66 | 12 | $1.97 | 58% | 0% |
| Bob | $16.51 | 25 | $0.66 | 76% | ✓ |
| Amy-Kimi | $14.50 | 14 | $1.04 | 0% | ✓ |
| Scout | $14.30 | 9 | $1.59 | 56% | 0% |
| Evaluator | $5.71 | 19 | $0.30 | 11% | ✓ |
| Amy | $3.57 | 22 | $0.16 | 5% | 0% |

## Bottom Line
- **Cost per session is IMPROVING** ($0.85 vs $1.12, -24%)
- **Error rate is WORSENING** (29.5% vs 13.6%) — driven by 429 rate limits from concurrent cron bursts
- **32.5% of total cost is wasted on error sessions** ($56.25)
- **Differential backoff fix deployed** — should reduce 429 impact when process reloads
- **Prompt caching remains the #1 remaining cost lever** — 50%+ potential savings, blocked on Hao/LiteLLM
