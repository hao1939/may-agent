# EXP-209: Results

**Status**: COMPLETE
**Date**: 2026-06-24

## Summary

Scout findings are genuinely used by bob — only 10% of citations are superficial. The scout→bob pipeline is producing real value, not citation theater.

## Data

| Arm | N | Classification | Rate |
|-----|---|---------------|------|
| Causal | 6 | Finding drove a new design, decision, or direction | 60% |
| Reinforcing | 3 | Finding confirmed existing direction with evidence | 30% |
| Superficial | 1 | Citation present but didn't influence output | 10% |

### Detailed Classifications

| Source | Scout Finding | Classification | Evidence |
|--------|-------------|---------------|----------|
| synthesis-dd769-dd770 | DD-769, DD-770 | Causal | Generated 3 new monitoring principles + guard architecture redesign from findings |
| batch-resolve | H-095, H-053, H-058, H-009, H-043, H-166 | Causal | 6 hypotheses resolved; H-166 refutation changed intervention design space |
| scout-hypothesis-triage | H-069 through H-072 | Causal | Triage produced EXP-200 design directly from H-072 |
| EXP-011-finish-verification-gate | EXP-099 FM-3.3 data | Causal | Entire experiment designed around the 20.3% finding |
| context-injection-review | KE-002 | Causal | Drove REMOVE decision for active recall layer |
| batch-resolve (cross-thread) | H-166 refutation | Causal | Changed from binary to gradient model for knowledge interventions |
| deep-research | H-043 | Reinforcing | Bob already analyzing knowledge gap; scout data quantified it |
| DD-770 synthesis | KE-123 | Reinforcing | Confirms existing over-intervention principle |
| DD-769 synthesis | KE-091 | Reinforcing | Validates existing belief about guard harm on creative tasks |
| brief-common-sense-20260418 | DD#757-758, CR#340 | Superficial | Mentioned as timeline markers only |

## Analysis

H-209a predicted ≥30% superficial citations. Actual: 10%. **H-209a is REFUTED.**

The scout→bob pipeline works well because:
1. Bob creates **synthesis documents** that actively integrate scout findings into system design decisions
2. Bob uses scout hypotheses to **design experiments** (EXP-200 from H-072, EXP-011 from EXP-099)
3. Even "reinforcing" citations add value by quantifying intuitions

The single superficial citation was in a timeline/changelog context — low-stakes.

## Conclusion

**H-209a REFUTED.** Scout findings genuinely influence bob's decisions. The coordination pipeline is working as intended. No intervention needed.

## Followups

- Monitor over time — if bob stops doing synthesis docs, citation quality may degrade
- The 30% "reinforcing" rate is healthy — not every citation needs to redirect, sometimes confirmation is valuable
