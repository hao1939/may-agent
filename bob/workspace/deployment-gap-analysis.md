# Proven Skill Deployment Gap Analysis

**Date**: 2026-04-26 | **Author**: bob

## Summary

4 gym-proven workflow skills remain undeployed. Combined evidence: 32/33 pass rate (97%) vs baselines averaging 40%. These are the highest-leverage improvements available with zero research risk.

## Undeployed Proven Skills

| Skill | Evidence | Effect Size | Deployment Blocker |
|-------|----------|-------------|-------------------|
| evidence-over-narrative | 11/11 vs 5/8 (37pp) | Large | Needs workflow enforcement in coder |
| verify-before-finish | 6/6 vs 5/6 (17pp) | Medium | Needs workflow enforcement in coder |
| obstacle-pivot | 6/6 vs 0/3 (100pp) | Maximum | Needs workflow enforcement in all agents |
| sycophancy-resistance | 9/9 vs 3/6 (50pp) | Large | Needs L5 strict workflow + materialization gate |

## Key Constraint

All 4 require **workflow enforcement** — text injection doesn't work (0/19+ failures across all text-injection experiments). This means deployment requires changes to agent dispatch/orchestration, not just adding files.

## Recommendation

Priority order for deployment:
1. **obstacle-pivot** — 0%→100% on escalation. Prevents stuck-loop failures.
2. **sycophancy-resistance** — 50pp lift. Prevents agents ignoring their own analysis.
3. **evidence-over-narrative** — 37pp lift on correctness verification.
4. **verify-before-finish** — 17pp lift, smallest but still significant.

## Action Required

May/tech-lead: implement workflow enforcement mechanism that can wrap agent tasks with multi-phase execution (assess→act pattern). This is the single highest-ROI infrastructure investment available.
