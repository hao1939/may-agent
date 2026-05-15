# Metric Probe: Intervention Hit Rate — 2026-04-18

**Metric**: Intervention hit rate (target: 0.6)
**Current estimate**: ~0.09 (9%)

## Data Sources

1. **KE-007 (historical)**: 5 promoted / 56 tested = 8.9% hit rate across all coach experiments.
2. **prove-the-loop project (current)**: 0 successful / 4 deployed interventions = 0%.
   - C1.5 (scope rule): reverted — quality dropped 0.825→0.713 post-deploy.
   - C1.6 (post-write verify rule): reverted — same window, contributed to regression.
   - C1.7 (context-awareness rule): reverted — same window.
   - Evidence-count guard: kept but no measurable production impact (gym null-signal x5).

## Assessment

The 0.6 target is unrealistic given historical data. A 9% hit rate is normal for behavioral interventions — most ideas don't work. Two interpretations:

1. **Redefine the metric**: Hit rate measures "experiments that teach us something" (including negative results), not just "promoted interventions." By that standard, ~60-70% of experiments are informative.
2. **Accept low hit rate**: 9% promotion rate is fine if we run enough experiments. The issue isn't hit rate — it's throughput.

**Recommendation**: Redefine this metric as "experiments producing actionable knowledge" rather than "interventions that improve target metric." Current definition sets an unachievable bar.
