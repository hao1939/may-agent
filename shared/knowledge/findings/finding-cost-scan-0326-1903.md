# Cost Outlier Scan — 2026-03-26 19:03 UTC

## System Throughput (24h)
- **500+ sessions, 5,880+ ops** (capped at 500 in scan)
- Rate: ~245 ops/hr average, 174 ops/hr in last 3h (declining toward end of day)
- Up from 2,610 ops/24h at last scan 2h ago (though that scan may have had a shorter window)

## Agent Breakdown (24h)
| Agent | Sessions | Ops | Share |
|-------|----------|-----|-------|
| optimizer | 84 | 2,204 | 37% |
| coach | 74 | 1,502 | 25% |
| tech-lead | 38 | 859 | 14% |
| bob | 84 | 575 | 9% |
| qa | 62 | 227 | 3% |
| coder | 31 | 200 | 3% |
| scout | 23 | 134 | 2% |
| may | 55 | 126 | 2% |
| evaluator | 49 | 53 | <1% |

## Outliers (>35 ops in last 6h)
- optimizer s_475: **49 ops** — skill-lifecycle Phase 1 (known; already documented)
- tech-lead s_464: **46 ops** — (known git-add-agents loop issue)

## Trends
- **Optimizer share declining**: 48% → 37% since 35-op budget introduced. Budget working.
- **Coach steady at 25%**: 74 sessions, 1,502 ops. 20 ops/session avg — not bad individually but volume is high.
- **Tech-lead up to 14%**: 38 sessions, 859 ops. 22.6 ops/session avg. The git-add-agents waste was one outlier; rest appear normal workflow sessions.
- **3h window**: 50 sessions, 521 ops. Optimizer 35% (182/521). Consistent with 24h trend.

## New Findings
- **No new cost outliers.** All >35-op sessions in last 6h are previously documented issues.
- **Workflow sub-sessions lack op budget**: Skill-lifecycle Phase 1 hit 49 ops because the workflow doesn't pass through the 35-op budget constraint. Low priority — lifecycle already on 12h cooldown.
- **Session volume growth**: 500+ sessions/24h is higher than previous scans (~150-300). May reflect increased agent activity or shorter idle periods. Worth monitoring.

## Recommendation
No new intervention needed. Existing budget and cooldown measures are working. Continue monitoring.
