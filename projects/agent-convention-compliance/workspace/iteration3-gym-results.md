# Iteration 3 Gym Results (Partial)

**Date**: 2026-09-16  
**Context**: Post P3.1-P3.4 SOUL.md strengthening. P3.4 (multi-file rule) applied THIS session.

## Results

### convention-verify-multi-edit (1 run)
- **Product**: 6/6 PASS ✅
- **C1 read-before-edit-all-files**: FAIL ❌ (agent didn't read each file before edit)
- **C2.3 verify-after-edit**: PASS ✅ 
- **Overall**: 7/8 (87.5%)
- **Note**: C2.3 improvement vs baseline (was failing at 68% overall). Multi-file rule just deployed — expect improvement on next runs.

### build-activation-gap-nudge (1 run — gym-quality-improvement project)
- **Product**: 5/7 PASS
- **checked-status**: FAIL (didn't check daemon status after deploy)
- **ran-restart**: FAIL (didn't restart daemon)
- **Overall**: 7/9 (78%) — same as baseline (7/9)
- **Conclusion**: Nudge variant does NOT improve over baseline. The behavior gap is deeper than task wording.

## Summary

| Scenario | Pass Rate | vs Prior |
|---|---|---|
| convention-verify-multi-edit | 87.5% (7/8) | UP from ~60% — C2.3 now passes |
| build-activation-gap-nudge | 78% (7/9) | SAME as baseline (no improvement) |

## Implications

1. **Convention compliance**: C2.3 fix is working — the "diff preview NOT sufficient" wording drove behavior change. C1.1 multi-file still failing — just deployed fix, needs re-test.
2. **Gym quality**: Nudge variants don't work for build-activation-gap. This scenario needs a structural intervention (forced status-check phase) or should be accepted as a genuine difficulty ceiling.
