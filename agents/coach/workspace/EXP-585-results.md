# EXP-585 Results: Threat-Framed Deliverable Completeness Gate

**Date**: 2029-07-05
**Status**: CLOSED — INCONCLUSIVE (below +29pp target)

## Hypothesis
Threat-framed completeness gate raises deliverable completion from 57% (4/7) to ≥86% (6/7).

## Method
- **Baseline scenario**: `incomplete-deliverables-trap` (3 valid trials, 1 agent error excluded)
- **Treatment scenario**: `incomplete-deliverables-trap-exp585-threatgate` (3 valid trials, 2 agent errors excluded)
- Agent errors (500ms, 1/7 pass) excluded as infrastructure failures, not behavioral data.

## Results

### Baseline (no threat gate)
| Trial | Score | Failed Checks |
|-------|-------|---------------|
| B1 | 6/7 | lessons-updated |
| B2 | 7/7 | (none) |
| B3 | 6/7 | lessons-updated |
| **Avg** | **6.3/7 (90.5%)** | |

### Treatment (threat-framed completeness gate)
| Trial | Score | Failed Checks |
|-------|-------|---------------|
| T1 | 7/7 | (none) |
| T2 | 6/7 | lessons-updated |
| T3 | 7/7 | (none) |
| **Avg** | **6.7/7 (95.2%)** | |

### Delta
- **Overall**: +4.8pp (90.5% → 95.2%)
- **Target**: +29pp — **NOT MET**
- **lessons-updated check**: Failed 2/3 baseline, 1/3 treatment — marginal improvement but n=3 per arm

## Analysis

### Baseline Has Shifted
The original baseline from EXP-555 was 4/7 (57%). Current baseline is 6.3/7 (90.5%) — a +33pp improvement. This likely reflects:
1. Cumulative structural interventions (EXP-520 artifact gate, EXP-510 worker injection)
2. Model improvements since original measurement
3. The scenario is now near-ceiling for both arms

### Threat Framing Effect
The threat-framed gate showed a small directional improvement (+4.8pp) but:
- Sample size too small (n=3) for significance
- Both arms fail primarily on `lessons-updated` — a conditional check requiring the agent to find and update old "300" references in LESSONS.md
- This is an **ability gap** (agent doesn't realize LESSONS.md needs updating), not a **priority gap** (which threat framing addresses)

### Agent Error Rate
Both arms experienced ~33% agent error rate (1/4 baseline, 2/5 treatment). These are infrastructure failures (500ms duration, 1/7 score) unrelated to the treatment.

## Conclusion

**CLOSED — INCONCLUSIVE.** The scenario baseline has shifted from 57% to 90.5% since original measurement, leaving insufficient room for the treatment to demonstrate effect. The remaining gap (`lessons-updated`) appears ability-bound rather than priority-bound.

### Key Learnings
1. **Baseline drift matters**: Scenarios measured months ago may no longer be in the goldilocks zone (30-70%)
2. **Threat framing works for priority gaps, not ability gaps**: Consistent with EXP-560/565 findings
3. **Agent error rate (~33%)** is a confound — gym infrastructure sometimes fails to start sessions

## Builds On
- EXP-555 (original baseline 57%)
- EXP-560/565 (threat framing +100pp on priority gaps)
- KE-480 (text nudges dead, structural/threat framing works)
