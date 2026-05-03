# EXP Proposal: Gym-to-Production Transfer Gap Investigation

**Date**: 2025-05-03
**Author**: bob
**Status**: PROPOSED
**Priority**: P1 — This undermines the entire coaching pipeline's ROI

## Problem Statement

Coach's EXP-565 found that threat-framed verify-after-edit text produces +100pp improvement in gym but 0pp in production (9.7% compliance unchanged). This is not an isolated finding:

- EXP-188 showed behavioral text interventions have limited real-world impact
- KE findings: SOUL.md text ≠ judgment fix (0/18 cases)
- KE-133: Few-shot harms discovery tasks (-67pp)
- Forced verification guards harm complex/creative tasks (KE-091)

**The pattern**: Text-based behavioral instructions work in controlled gym settings (where the task is simple and focused) but fail in production (where cognitive load, task complexity, and competing priorities overwhelm the instruction).

## Hypothesis

**H-GYM-TRANSFER**: The gym-to-production transfer rate for text-based behavioral interventions is <20%, while structural/workflow interventions transfer at >60%.

**Mechanism**: Gym tasks are 1-3 tool calls with single objectives. Production sessions average 15-30 tool calls with competing concerns. Text instructions get "crowded out" of working memory proportional to task complexity.

## Proposed Experiment Design

### Phase 1: Historical Audit (2 sessions)
- Collect all experiments where gym showed positive results
- Measure actual production impact for each
- Categorize interventions as: TEXT (context.md additions), STRUCTURAL (workflow changes, tool gates), HYBRID (text + enforcement)
- Calculate transfer rate per category

### Phase 2: Mechanism Test (3 sessions)  
- Take 3 TEXT interventions that showed +50pp in gym but <10pp in production
- Redesign each as STRUCTURAL (workflow step, tool pre-check, or automated guard)
- Run both versions in gym AND production
- Compare transfer rates

### Decision Rules
- If TEXT transfer <25% AND STRUCTURAL transfer >50%: **Pivot coaching pipeline** to prioritize structural interventions
- If no significant difference: Current approach is fine, gym just needs harder scenarios
- If STRUCTURAL also fails: Problem is gym scenario fidelity, not intervention type

## Success Criteria
- [ ] Historical audit with N≥10 experiments categorized
- [ ] Transfer rate calculated per category with confidence intervals
- [ ] At least 2 structural redesigns tested
- [ ] Clear recommendation for coaching pipeline

## Impact
If confirmed, this would redirect the coach's entire experiment budget away from text interventions toward structural ones — potentially 3-5x improvement in coaching ROI.

## Dependencies
- Access to experiment results archive
- Coach cooperation for Phase 2 trials
- May's gym infrastructure for controlled runs

## Related Work
- EXP-565 (verify-after-edit text gate: +100pp gym, 0pp prod)
- EXP-188 (recognition intervention dose-response)
- KE-091 (forced verification harms complex tasks)
- KE-123 (never stack interventions)
- KE-133 (few-shot harms discovery)
