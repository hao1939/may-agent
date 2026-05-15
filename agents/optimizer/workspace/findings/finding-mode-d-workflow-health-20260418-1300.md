# Finding: Workflow Health — 2026-04-18 13:00 (Mode D)

**Scan window**: Last 6 hours (Apr 18, ~07:00–13:00 UTC)

## Adoption Rate

| Metric | Current (6h) | Previous (Apr 12) |
|--------|-------------|-------------------|
| System-wide | **6.6%** (1,613/24,479) | 27.1% |

**Significant drop from 27.1% → 6.6%.** This likely reflects a change in how sessions are counted or a shift in workload mix rather than agents abandoning workflows.

## Per-Agent Adoption (core agents, last 6h)

| Agent | Total | Workflow | Rate |
|-------|-------|----------|------|
| coder | 434 | 215 | **49.5%** |
| optimizer | 2,314 | 370 | 16.0% |
| bob | 3,195 | 441 | 13.8% |
| coach | 3,273 | 315 | 9.6% |
| qa | 1,088 | 102 | 9.4% |
| tech-lead | 2,659 | 125 | 4.7% |
| scout | 1,358 | 18 | 1.3% |
| may | 4,610 | 27 | 0.6% |
| evaluator | 3,288 | 0 | 0.0% |
| amy/amy-kimi | 1,944 | 0 | 0.0% |

**Coder leads** at 49.5% — nearly half its sessions are workflow-dispatched. Evaluator and amy variants have zero workflow adoption.

## Efficiency: Workflow vs Non-Workflow

| Group | Sessions | Avg Productive | Avg Wasted | Avg Efficiency |
|-------|----------|---------------|------------|---------------|
| Non-workflow | 22,850 | 14.5 | 2.0 | 0.50 |
| Workflow | 1,610 | 1.0 | 0.5 | 0.70 |

Workflow sessions are much smaller (1.0 productive calls avg) but more efficient (0.70 vs 0.50). This is expected — workflow child sessions are tightly scoped sub-tasks. The low op count confirms workflows decompose work into small focused units.

## Workflow Session Types

- **call** (child): 1,490 (92.4%)
- **null/root**: 124 (7.6%)

~12 child sessions per workflow root on average.

## Key Observations

1. **Adoption dropped from 27.1% to 6.6%** — needs investigation. Could be session volume growth diluting workflow share, or workflow usage genuinely declining.
2. **No new adopters** — evaluator, amy, amy-kimi still at 0%. Same agents using workflows as before.
3. **No overhead concern** — workflow sessions are lean (1.0 ops avg) with higher efficiency. No evidence of excess ops from workflow coordination.
4. **Coder is the workflow champion** at 49.5% — likely because coding tasks are naturally decomposable.

## Recommendation

- Investigate the adoption drop: is it real decline or measurement artifact?
- Consider workflow templates for evaluator (could parallelize evaluation sub-tasks)
- The efficiency advantage (0.70 vs 0.50) validates continued workflow investment
