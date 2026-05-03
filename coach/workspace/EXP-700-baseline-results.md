# EXP-700 Phase 0+1 Results: Parallel Tool Calls

**Date**: 2029-08-03
**Status**: INCONCLUSIVE — transcript data unavailable for parallelism measurement

## Runs

### Baseline (no skill injection)

| Run | Product | Convention | Duration |
|-----|---------|------------|----------|
| 1   | 3/4     | 4/4        | 63.1s    |
| 2   | 3/4     | 3/4        | 55.9s    |
| 3   | 3/4     | 3/4        | 99.2s    |

**Mean duration**: 72.7s | **Task success**: 3/3 (≥6/8 checks)

### Treatment (batch-independent-calls skill)

| Run | Product | Convention | Duration |
|-----|---------|------------|----------|
| 1   | 3/4     | 3/4        | 58.0s    |
| 2   | 3/4     | 3/4        | 56.5s    |
| 3   | 3/4     | 3/4        | 58.3s    |

**Mean duration**: 57.6s | **Task success**: 3/3 (≥6/8 checks)

## Analysis

### Duration
- Baseline mean: 72.7s (high variance: 55.9–99.2s)
- Treatment mean: 57.6s (low variance: 56.5–58.3s)
- **Delta**: -15.1s (-20.8%)
- **Variance reduction**: Treatment much more consistent (σ=1.0s vs σ=23.3s)

### Task Quality
- Both arms: 3/4 product consistently (same check failing: `correct-errors`)
- Convention: Baseline slightly better on run 1 (4/4) but otherwise same
- **No quality degradation** from skill injection ✅

### Parallelism Measurement — BLOCKED
- Gym runner does NOT persist session transcripts
- Cannot measure calls-per-block or total blocks directly
- Duration is a proxy: faster + more consistent suggests batching independent reads

## Limitations

1. Cannot directly measure parallelism ratio (primary metric) without transcript access
2. Duration difference could be noise given baseline variance (n=3 is small)
3. The `correct-errors` check fails in both arms — unrelated to parallelism skill

## Conclusion

**INCONCLUSIVE on primary metric** (parallelism ratio unmeasurable).

**Directionally positive** on secondary metrics:
- 20.8% faster mean duration (treatment)
- 95% variance reduction (treatment)
- No quality degradation

## Recommendation

- **Do NOT deploy** based on this data alone — effect size on quality is 0pp
- **Next**: Either modify gym runner to persist transcripts OR design scenario where parallelism directly affects pass/fail (e.g., timeout-bound task)
- Consider closing as INCONCLUSIVE — the skill doesn't hurt but benefit is unmeasured

## Status: CLOSED — INCONCLUSIVE

The experiment design assumed transcript access. Without it, we can only observe duration (proxy). The skill shows no quality improvement (+0pp) and modest speed improvement (~15s). Not worth deploying without stronger evidence.
