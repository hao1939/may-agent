# EXP-182: Results

**Status**: CONCLUDED — NULL RESULT

## Summary

Fragility ratings injected via `--common-sense` overlay produced zero improvement across all three scenarios. Two scenarios were at ceiling (100% baseline), and the third (partial-verification-trap) failed 0/5 in both arms. H-182-null confirmed.

## Data

| Arm | Scenario | N | Pass rate | Notes |
|-----|----------|---|-----------|-------|
| A (baseline) | compound-edit-verification | 5 | 100% | ceiling |
| A (baseline) | compound-edit-verification-checkpoint | 5 | 100% | ceiling |
| A (baseline) | partial-verification-trap | 5 | 0% | floor |
| B (treatment) | compound-edit-verification | 5 | 100% | ceiling |
| B (treatment) | compound-edit-verification-checkpoint | 5 | 100% | ceiling |
| B (treatment) | partial-verification-trap | 5 | 0% | floor |
| **Overall** | | **15 vs 15** | **67% vs 67%** | **0pp Δ** |

## Analysis

H-182-null confirmed. The fragility overlay had zero effect because:
1. Two of three scenarios were at 100% baseline — no room for improvement (violates KE-010 pre-screening rule).
2. The failing scenario (partial-verification-trap) fails because agents don't add edge-case tests, which generic "fragility" labels don't address.
3. Passive declarative knowledge ("this surface is fragile") doesn't translate to procedural behavior change — consistent with KE-002 and KE-011.

## Conclusion

**Falsified.** Fragility ratings are passive text that agents ignore, producing 0pp improvement. This is another instance of KE-002 (text rules ≈ 0% behavioral effect).

## Followups

- KE-010 reinforced: always pre-screen scenarios for baseline < 80%
- No deployment — intervention discarded
- Future verification interventions should be procedural (forced steps), not declarative (risk labels)
