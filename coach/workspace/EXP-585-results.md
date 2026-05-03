# EXP-585 Results: Deliverable Completeness Threat Gate

## Summary
**INCONCLUSIVE** — Baseline has drifted from documented 4/7 (57%) to 6/7 (86%), leaving insufficient room for the treatment to demonstrate effect. Treatment shows marginal improvement (2/3 perfect scores vs 0/3 baseline).

## Baseline (3 fresh trials, 2028-09-02)
| Trial | Checks | Failed |
|-------|--------|--------|
| B1 | 6/7 | lessons-updated |
| B2 | 6/7 | lessons-updated |
| B3 | 6/7 | lessons-updated |
| **Mean** | **6.0/7 (86%)** | |

Note: Prior baseline was 4/7 (57%) from 2 runs. Baseline has improved +29pp, likely due to cumulative interventions (EXP-510 worker injection, EXP-520 artifact gate).

## Treatment (3 trials, threat-framed completeness gate)
| Trial | Checks | Failed |
|-------|--------|--------|
| T1 | 6/7 | lessons-updated |
| T2 | 7/7 | — |
| T3 | 7/7 | — |
| **Mean** | **6.7/7 (95%)** | |

## Analysis
- **Delta**: +9pp (86% → 95%) — below the +29pp target
- **Target met?** ≥6/7 in ≥2/3 trials → YES (3/3 trials ≥6/7) but baseline ALSO meets this
- **Treatment unique effect**: 2/3 perfect (7/7) vs 0/3 baseline — directionally positive
- **Persistent failure**: `lessons-updated` check (conditional deliverable requiring LESSONS.md update from 300→600). Agent reads LESSONS.md (checked-lessons passes) but doesn't always complete the edit correctly. This is an **ability gap**, not an awareness/priority gap.

## Conclusion
The threat-framed gate does not demonstrate significant incremental effect over current baseline. The original hypothesis was based on a 57% baseline that no longer holds. The remaining failure (`lessons-updated`) is ability-bound — the agent reads the file but fails to make the correct conditional edit.

## Decision
- **Status**: CLOSED — INCONCLUSIVE (baseline drift)
- **Threat framing for deliverable completeness**: Not proven on this scenario
- **lessons-updated**: Ability-bound failure, not addressable by framing interventions
- **No deployment** — insufficient evidence of treatment effect

## Next Steps
- If a new scenario with genuine awareness/priority-gap deliverables is found, revisit threat framing
- Consider EXP-590 (Threat-Gate Durability Check) as next priority — validates existing deployed gates
