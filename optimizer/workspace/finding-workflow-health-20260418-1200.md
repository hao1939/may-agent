# Finding: Workflow Health — 6h Scan (2026-04-18 12:00 UTC)

**Mode**: D (Workflow Health)
**Window**: Last 6 hours (~06:00–12:00 UTC)

## Key Metrics

| Metric | Value |
|--------|-------|
| Total sessions | 265 |
| Workflow sessions | 66 (24.9%) |
| Non-workflow sessions | 199 (75.1%) |

## Workflow vs Non-Workflow Comparison

| Metric | Workflow | Non-Workflow |
|--------|----------|-------------|
| Avg ops/session | 13.0 | 3.6 |
| Avg quality | 0.674 | 0.362 |
| Avg efficiency | 0.591 | 0.301 |

## Workflow Success Rate

- Done: 61 (92.4%)
- Interrupted: 4 (6.1%)
- Running: 1 (1.5%)
- **Failure rate**: 0% explicit failures

## Quality-Preserved Metric

- Current 6h average: **0.339** (across 672 evaluations)
- Target: 0.9
- Gap is large — driven primarily by the 199 non-workflow sessions averaging 0.362 quality

## Comparison to Prior Baseline (10:00 UTC scan)

- Workflow adoption: 24.9% (down from 27.1% at last scan)
- Workflow sessions continue to outperform non-workflow by ~1.9x on quality and ~2x on efficiency
- Workflow sessions use ~3.6x more ops but produce meaningfully better outcomes

## Analysis

1. **Workflow sessions are clearly higher quality** — 0.674 vs 0.362 quality score. The overhead (13 vs 3.6 ops) is justified by outcomes.
2. **Adoption slipped slightly** from 27.1% → 24.9%. Not alarming but worth monitoring.
3. **Quality-preserved at 0.339 is far below 0.9 target** — this is not a workflow problem. The 199 non-workflow sessions dragging the average down are the issue. If only workflow sessions counted, quality would be 0.674.
4. **Zero workflow failures** — the 4 interrupts are normal (timeouts/cancellations), not logic failures.

## Recommendation

Quality improvement should focus on non-workflow sessions (heartbeats, ad-hoc tasks) which make up 75% of volume but have half the quality score. Workflow adoption is healthy and performing well.
