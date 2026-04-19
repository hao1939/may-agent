# Agent Productivity Report — Commits per Session

Generated: 2026-04-12 01:57:56 UTC
Git repo: agents/ (3247 total commits, 1126 system, 722 unattributed)
DB: may.db (19356 ended sessions)

## All-Time

| Agent | Commits | Sessions | Commits/Session | Success Rate |
|-------|---------|----------|-----------------|--------------|
| scout | 227 | 1064 | 0.213 | 71.2% |
| qa | 130 | 794 | 0.164 | 93.7% |
| bob | 311 | 2599 | 0.120 | 74.3% |
| optimizer | 158 | 1700 | 0.093 | 76.4% |
| coder | 21 | 288 | 0.073 | 85.8% |
| may | 273 | 4206 | 0.065 | 80.2% |
| coach | 168 | 2623 | 0.064 | 72.1% |
| evaluator | 69 | 2066 | 0.033 | 98.0% |
| amy-kimi | 14 | 1008 | 0.014 | 85.8% |
| tech-lead | 24 | 2084 | 0.012 | 79.3% |
| amy | 4 | 921 | 0.004 | 71.0% |

## Last 24 Hours

| Agent | Commits | Sessions | Commits/Session |
|-------|---------|----------|-----------------|
| scout | 56 | 48 | 1.167 |
| may | 56 | 52 | 1.077 |
| amy-kimi | 2 | 2 | 1.000 |
| qa | 30 | 48 | 0.625 |
| optimizer | 62 | 111 | 0.559 |
| bob | 42 | 120 | 0.350 |
| coach | 21 | 76 | 0.276 |
| evaluator | 12 | 52 | 0.231 |
| tech-lead | 6 | 84 | 0.071 |
| coder | 0 | 3 | 0.000 |

## Last 7 Days

| Agent | Commits | Sessions | Commits/Session |
|-------|---------|----------|-----------------|
| coder | 12 | 8 | 1.500 |
| may | 235 | 277 | 0.848 |
| scout | 215 | 261 | 0.824 |
| bob | 271 | 572 | 0.474 |
| qa | 123 | 265 | 0.464 |
| optimizer | 131 | 377 | 0.347 |
| coach | 138 | 508 | 0.272 |
| evaluator | 60 | 353 | 0.170 |
| amy-kimi | 3 | 73 | 0.041 |
| tech-lead | 13 | 344 | 0.038 |

## Key Observations

- **Overall ratio**: 1399 agent commits / 19353 sessions = 0.072 commits/session
- **Highest commits/session**: scout (0.213)
- **Lowest commits/session**: amy (0.004)

## Methodology Notes

- Commits attributed by commit message prefix (e.g. `bob: ...` -> bob)
- System commits (Merge, chore(auto)) excluded from agent counts
- Sessions normalized: `bob-c40` -> `bob`, `tl-c44` -> `tech-lead`, etc.
- Higher ratio != better. Some agents (evaluator, optimizer) produce analysis, not commits.
- Commits/session measures commit frequency, not quality or impact.
