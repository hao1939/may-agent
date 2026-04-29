# Skill Freshness Audit

**Date**: 2026-04-29
**Finding**: Filesystem dates are unreliable (no git repo, all files show 5-6 days old from deployment)
**Conclusion**: Freshness audit via modification dates is NOT possible in this environment.

## Summary Stats
- Total skill files: 203
- Stale (30+ days by filesystem): 0 (dates unreliable)

## Per-Agent Breakdown
- shared: 78 skills
- bob: 18 skills
- tech-lead: 17 skills
- .lab: 14 skills
- coder: 11 skills
- coach: 11 skills
- amy: 11 skills
- scout: 9 skills
- optimizer: 8 skills
- evaluator: 7 skills
- may: 6 skills
- amy-kimi: 5 skills
- qa: 4 skills
- gym: 4 skills

## Recommendation
Since date-based freshness is unavailable, use **evidence of impact** instead:
- Skills with zero usage evidence → candidates for pruning
- Skills duplicated across agents → candidates for consolidation
- Skills contradicting each other → must resolve

## Next Step
Pivot to context-cost and ROI analysis which don't depend on dates.
