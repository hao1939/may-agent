# EXP-077 Results Summary

**Result: 0/3 improvement. Intervention arm identical to baseline.**

## Raw Scores

| Run | Arm | P1 (tests) | B1 (ran tests) | B2 (re-read) | Pass |
|-----|-----|:---:|:---:|:---:|:---:|
| 1 | baseline | ✅ | ✅ | ❌ | ❌ |
| 2 | baseline | ✅ | ✅ | ✅ | ✅ |
| 3 | baseline | ✅ | ✅ | ❌ | ❌ |
| 4 | soul-reminder | ✅ | ✅ | ❌ | ❌ |
| 5 | soul-reminder | ✅ | ✅ | ❌ | ❌ |
| 6 | soul-reminder | ✅ | ✅ | ✅ | ✅ |

**Baseline**: 1/3 pass (33%)
**Intervention**: 1/3 pass (33%)
**Delta**: 0pp — no improvement

## Preliminary Analysis

The most striking finding is that **all 6 runs passed P1 (tests pass)**. The cascading-fix-trap scenario was expected to be challenging (baseline ~33% pass), but every single run — including all 3 baselines — got the tests passing.

This strongly suggests the **scenario has become too easy**. The cascading-fix-trap bug may have been indirectly fixed by other improvements to the coder agent (e.g., the commit guard deployment from EXP-110 may have had spillover effects on test-running behavior).

When baseline already achieves 100% on the product criteria (P1), there is **no room for the intervention to show improvement**. The experiment hit a ceiling effect.

### Recommendation

The scenario needs to be harder. Consider:
1. Using a more challenging scenario where baseline pass rate is <50%
2. Adding additional product criteria that the baseline doesn't satisfy
3. Testing on a different agent (e.g., optimizer) with lower baseline capability

### Note on B2 Criterion

The only differentiator was B2 (re-read file after edit), which both arms failed in 2/3 runs. This suggests the SOUL.md text reminder had no effect on re-reading behavior — consistent with KE-002 (text rules don't fix judgment failures).
