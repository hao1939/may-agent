# EXP-187: Results

**Status**: COMPLETE
**Date**: 2026-04-19

## Summary

Keyword-tagged INDEX showed a +13pp improvement in correct KE citation (60%→73%) but the difference was not statistically significant (p=0.35, Fisher's exact). The high baseline (60% control) surprised — agents already cite well from flat INDEX titles. Treatment helped on 2 specific questions (KE-034, KE-159) where keywords provided discriminative signal the title alone lacked.

## Data

| Arm | N | Correct | Rate | Avg reads | 
|-----|---|---------|------|-----------| 
| A (control) | 15 | 9 | 60% | 0.3 |
| B (treatment) | 15 | 11 | 73% | 0.1 |

**Difference**: +13pp (p=0.35, one-sided Fisher's exact)

### Per-question breakdown

| Q# | Target KE | Arm A | Arm B | Notes |
|----|-----------|-------|-------|-------|
| 1  | KE-002 | ✅ | ✅ | |
| 2  | KE-015 | ✅ | ✅ | |
| 3  | KE-022 | ✅ | ✅ | |
| 4  | KE-029 | ✅ | ✅ | |
| 5  | KE-034 | ❌ | ✅ | Keywords helped — "forced externalization" in title is ambiguous across KE-034/054/029 |
| 6  | KE-052 | ✅ | ✅ | |
| 7  | KE-054 | ✅ | ✅ | |
| 8  | KE-106 | ✅ | ✅ | |
| 9  | KE-123 | ✅ | ✅ | |
| 10 | KE-133 | ✅ | ✅ | |
| 11 | KE-140 | ❌ | ❌ | Both arms failed — question may not map cleanly to KE-140 |
| 12 | KE-143 | ❌ | ❌ | Both arms failed — agent cited many KEs but not KE-143 |
| 13 | KE-156 | ❌ | ❌ | Both arms failed |
| 14 | KE-159 | ❌ | ✅ | Keywords helped — "structured output" keyword disambiguated |
| 15 | KE-171 | ❌ | ❌ | Both arms failed |

## Analysis

1. **High baseline**: 60% control rate was much higher than the hypothesized 30%. The INDEX titles alone provide enough signal for most questions. This limits the ceiling for improvement.

2. **Treatment effect is real but small**: +13pp in the expected direction, but N=15 gives insufficient power to detect this effect size (would need N~60/arm for 80% power at 13pp).

3. **Near-zero reads**: Both arms averaged <0.5 reads per trial. Agents answered from INDEX content alone without reading the actual KE files. This means the INDEX is functioning as the primary knowledge source, not a pointer to files.

4. **Failure pattern**: The 4 questions that failed in both arms (Q11-Q13, Q15) target higher-numbered KEs (140, 143, 156, 171). These may appear later in INDEX where attention drops, or the questions may be inherently harder to match.

5. **Measurement concern**: The KE extraction counted ALL KE-xxx patterns in session output (including INDEX content itself). With reads=0 in most trials, agents likely cited KEs from reading the INDEX rather than from targeted retrieval. The metric measures "did the correct KE appear in output" which includes INDEX scanning, not discriminative retrieval specifically.

## Conclusion

**Inconclusive** — directionally positive (+13pp) but not statistically significant (p=0.35). H-187a (≥15pp improvement) is not confirmed. H-187-null (<5pp) is also not supported since the point estimate is 13pp.

The experiment has a **measurement validity issue**: with near-zero file reads, what we measured was whether the correct KE-xxx string appeared in output (largely from INDEX scanning), not whether keywords improved discriminative retrieval. A better design would measure whether agents open the *correct* file first.

## Followups

- Consider re-running with a harder task (require agents to quote content from the KE, not just cite it) to force actual file reads
- The high baseline suggests INDEX titles are already quite informative — keyword tagging may be low-ROI
- No KE warranted — effect is inconclusive and the measurement has validity concerns
