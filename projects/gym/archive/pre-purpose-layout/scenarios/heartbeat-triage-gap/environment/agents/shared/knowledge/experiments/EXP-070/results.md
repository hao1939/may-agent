# EXP-070 Results: Structural Gate for FM-3.3 (Verification Failure)

**Date**: 2026-04-07
**Status**: COMPLETE
**Hypothesis**: H-055 (forced externalization)

## Summary

Tested whether adding a structural verification gate (must run verification command before finish()) reduces FM-3.3 failures.

## Data

| Metric | Baseline | Treatment | Change |
|--------|----------|-----------|--------|
| FM-3.3 rate | 42% (21/50) | 25% (12/48) | -17pp (-40% relative) |
| False positive rate | 3% | 5% | +2pp |
| Tool calls per session | 18.2 avg | 21.4 avg | +3.2 (+18%) |
| Session completion rate | 94% | 91% | -3pp |

## Key Findings

1. **Structural gate works**: FM-3.3 rate dropped from 42% to 25%, a 40% relative reduction.
2. **Modest overhead**: +3.2 tool calls per session (18% increase). Acceptable.
3. **Slight completion regression**: 3pp drop in completion rate — some sessions hit timeout due to extra verification calls.
4. **H-055 support**: This is the 3rd experiment supporting forced externalization hypothesis. Posterior should increase.

## Recommendations

- Deploy structural verification gate to production coder
- Update H-055 Bayesian posterior
- Write KE-058 documenting structural gate effectiveness
