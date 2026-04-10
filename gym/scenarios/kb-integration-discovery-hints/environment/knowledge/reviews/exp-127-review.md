# EXP-127 Review Notes

**Reviewer**: Data Lead
**Date**: 2026-03-25
**Verdict**: Needs follow-up

## Review Summary
EXP-127 produced interesting but inconclusive results for the cache-first hypothesis.
The 45% latency reduction is promising but the N=50 sample size makes statistical
inference unreliable.

## Specific Concerns
1. **Sample size**: Power analysis suggests N≥500 for reliable detection of 40% effect
2. **Access pattern**: Uniform random is unrealistic; should use Zipf distribution
3. **Warm-up**: No warm-up period, cache was cold for early requests
4. **Duration**: 5-minute test window is too short for steady-state analysis

## Recommendation
Design a follow-up experiment (EXP-142) with:
- N=1000 (provides power >0.99 for 40% effect)
- Zipf access distribution (α=1.2)
- 100-request warm-up before measurement
- Longer measurement window (30+ minutes)

## Impact on H-042
Current evidence is insufficient to update P(H-042) significantly. Keep at 0.35 until
EXP-142 provides definitive results.
