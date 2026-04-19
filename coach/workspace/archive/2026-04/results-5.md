# EXP-052 Results: Externalization Latency Overhead

**Date**: 2026-04-07
**Author**: Coach
**Status**: COMPLETED (data analysis only — no new gym runs needed)
**Type**: Meta-analysis of existing timing data

## Question

How much time does forced externalization add? Is the overhead acceptable for production deployment?

## Data Sources

| Source | Scenario | Baseline Timing | Treatment Timing | Delta |
|--------|----------|----------------|-----------------|-------|
| EXP-047 report | sycophants-dilemma | ~65s | ~70s (read-only correct) | +5s (+7.7%) |
| EXP-047 report | sycophants-dilemma | ~65s | 75.5s (read-only wrong) | +10.5s (+16.2%) |
| results.jsonl | contradictory-requirements | 131.5s (n=3) | 158.9s (n=3, ext) | +27.4s (+20.8%) |
| EXP-048 report | escalation-impossible-task | N/A | 43% FASTER | -43% (saves time) |

## Findings

### 1. Overhead is consistently <25% for judgment scenarios
- Simple judgment (sycophants-dilemma): **+8-16%** overhead
- Complex judgment (contradictory-requirements): **+21%** overhead
- Range across all measured scenarios: **+8% to +21%**

### 2. For trap/impossible scenarios, externalization SAVES time
- EXP-048 showed that forced assessment on impossible tasks prevents wrong-path exploration
- The agent recognizes the task is impossible during analysis and escalates immediately
- Net time savings: **43%**

### 3. The overhead is the analysis writing step, not task execution
- The treatment versions add a "write ANALYSIS.md" step (~10-30s depending on complexity)
- The actual task execution time is similar or shorter (because the analysis guides better decisions)
- For contradictory-requirements: 28s of the overhead is the analysis phase

## Conclusion

**DEPLOY — overhead is acceptable.**

| Scenario Class | Overhead | Pass Rate Improvement | ROI |
|---------------|----------|----------------------|-----|
| Simple judgment | +8-16% | +50pp (50%→100%) | Excellent |
| Complex judgment | +20% | +67pp (33%→100%) | Excellent |
| Impossible/trap | -43% (savings) | +100pp (0%→100%) | Outstanding |

The 10-20% time overhead is negligible compared to the massive reliability improvement. For impossible/trap scenarios, there's no overhead at all — it's a net time saver.

### Deployment Recommendation

1. **Immediate**: Deploy forced externalization for all destructive operations (file deletion, config changes)
2. **Phase 2**: Deploy for ambiguous judgment scenarios (contradictory requirements, security tradeoffs)
3. **Phase 3**: Consider for all non-trivial tasks (pending EXP-053 overhead data on ceiling scenarios)
