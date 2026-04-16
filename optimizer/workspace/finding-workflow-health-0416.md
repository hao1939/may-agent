# Workflow Health Check — Apr 16, 2026

## Adoption Rate

| Period | WF Sessions | Total Sessions | Rate |
|--------|------------|----------------|------|
| Last 24h | 222 | 1,179 | **18.8%** |
| Last 7d | 738 | 4,564 | **16.2%** |

**Trend**: Down from 27.1% on Apr 12. Adoption has dropped ~10pp over 4 days. This may reflect workflow-eligible tasks declining or agents reverting to non-workflow patterns.

## Workflow Efficiency by Agent (7d)

| Agent | Avg Efficiency | Avg Quality | N |
|-------|---------------|-------------|---|
| optimizer | 0.73 | 0.89 | 220 |
| bob | 0.71 | 0.86 | 321 |
| tech-lead | 0.70 | 0.79 | 72 |
| coder | 0.67 | 0.76 | 51 |
| coach | 0.64 | 0.74 | 47 |
| may | 0.61 | 0.59 | 17 |
| scout | 0.58 | 0.67 | 7 |
| qa | 0.55 | 0.78 | 2 |

**Note**: No non-workflow work sessions returned for comparison (all work sessions appear to go through workflows now, or the `kind` field filtering excludes them).

## OpCount Budget Compliance

- **Average ops per WF session**: 16.9 (slightly above 15-op target)
- **Range**: 0–187 ops
- Sessions ≤15 ops exist but many exceed the budget, with outliers up to 187 ops.

The D-o-R Phase 1 budget of ≤15 ops is being met by some sessions but the average (16.9) suggests marginal compliance. The high outliers (90-187 ops) indicate some workflow sessions balloon significantly.

## FM-3.3 (Verification Failure) Rate

| Period | FM-3.3 Count | Total Evals | Rate |
|--------|-------------|-------------|------|
| Last 24h | 175 | 3,355 | **5.2%** |
| Last 7d | 283 | 6,525 | **4.3%** |

FM-3.3 rate has increased slightly in the last 24h (5.2% vs 4.3% 7d average). This is optimizer's most frequent failure mode and warrants continued attention.

## Key Findings

1. **Adoption down 10pp** from Apr 12 baseline (27.1% → 16.2% 7d). Investigate whether this reflects fewer workflow-eligible tasks or adoption regression.
2. **Budget marginally exceeded** — avg 16.9 ops vs 15-op target. The long tail (up to 187) drags the average up.
3. **FM-3.3 trending up** — 5.2% in last 24h vs 4.3% 7d average. Not alarming but worth watching.
4. **Bob and optimizer dominate WF usage** (321 + 220 = 541 of 738 = 73% of all WF sessions).
5. **Quality is strong** across the board — all agents above 0.59 quality, with optimizer leading at 0.89.

## Recommendations

- **R1**: Investigate adoption drop — are there task types that should use workflows but don't?
- **R2**: Address budget outliers — sessions >50 ops in a workflow likely indicate Phase 2 scope creep.
- **R3**: Continue FM-3.3 mitigation — the verify-wrap pattern and post-edit read-back are working but not fully penetrating.
