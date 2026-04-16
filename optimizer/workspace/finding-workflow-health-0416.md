# Finding: Workflow Health Check — Apr 16, 2026

## Workflow Adoption (last 24h)

**System-wide: 18.4%** (187/1019 sessions) — DOWN from 27.1% on Apr 12.

| Agent | Total | Workflow | Rate |
|-------|-------|----------|------|
| bob | 110 | 62 | 56% |
| optimizer | 98 | 46 | 47% |
| tech-lead | 120 | 31 | 26% |
| coder | 120 | 23 | 19% |
| coach | 93 | 19 | 20% |
| scout | 55 | 4 | 7% |
| qa | 50 | 2 | 4% |
| evaluator | 261 | 0 | 0% |
| may | 63 | 0 | 0% |
| amy | 49 | 0 | 0% |

### Key observations
- **Adoption dropped ~9pp** from 27.1% → 18.4%. The evaluator's 261 zero-workflow sessions dilute the system rate heavily. Excluding evaluator: 187/758 = **24.7%** — still down from Apr 12.
- **bob** leads at 56%, **optimizer** at 47%. These two account for 58% of all workflow sessions.
- **scout, qa** remain low adopters despite having workflows available.
- **evaluator, may, amy** have 0% — evaluator is expected (automated), may/amy may lack workflow definitions.

## Cost / Efficiency

| Agent | n | Avg Efficiency | Avg Quality |
|-------|---|---------------|-------------|
| amy | 49 | 0.75 | 0.99 |
| may | 61 | 0.73 | 0.93 |
| scout | 54 | 0.73 | 0.94 |
| tech-lead | 119 | 0.71 | 0.90 |
| coach | 92 | 0.71 | 0.86 |
| coder | 120 | 0.70 | 0.82 |
| optimizer | 96 | 0.69 | 0.88 |
| qa | 49 | 0.68 | 0.81 |
| bob | 109 | 0.63 | 0.77 |

- **opCount data sparse** — only coach (23.3 avg, n=8), optimizer (20.0, n=1), bob (8.0, n=1) reported non-zero opCounts for cron sessions. Most sessions don't populate opCount.
- D-o-R budget cap check inconclusive due to sparse opCount data. Coach's 23.3 avg suggests some sessions exceed the 9.4 target, but sample size is small.

## Recommendations
1. **Investigate adoption drop** — why did workflow usage fall from 27.1% to 18.4%? Check if workflow definitions were removed or if routing changed.
2. **scout/qa workflow nudge** — both at <10% adoption despite available workflows. Consider adding workflow routing to their handlers.
3. **opCount tracking** — most sessions report 0 opCount, making budget analysis unreliable. Fix opCount population for accurate D-o-R monitoring.
