# Skill Usefulness-Rate Metric Redesign

**Date**: 2026-07-02
**Context**: Current usefulness-rate is 0.33 (raw). The metric is supposed to measure whether skills actually help agents succeed, but it's conflated with infrastructure failures and unclear attribution.

## Problem with Current Metric

The current "usefulness-rate" attempts to measure: "Of sessions where a skill was available, did the session succeed?" This is flawed because:

1. **Attribution gap**: Session success/failure has many causes. A skill being "available" doesn't mean it was relevant to the task.
2. **Infrastructure noise**: Sessions fail due to tool errors, timeouts, env issues — not skill deficiencies.
3. **Denominator inflation**: All 79 shared skills are "available" in every session, making the denominator enormous and the signal diluted.

## Proposed Redesign: Skill Activation Rate + Activated Skill Success Rate

### Metric 1: `skill.activation-rate` (replaces usefulness-rate)
**Definition**: Of sessions where a skill was RELEVANT to the task type, was there evidence the agent applied the skill?

**Measurement**:
- Map skills to task categories (e.g., `coder-edit-discipline` → coding tasks, `verification` → any task with deliverables)
- For each relevant session, check if skill behaviors are present (structural markers, not just text mentions)
- Rate = sessions-with-evidence / sessions-where-relevant

**Target**: ≥0.70

### Metric 2: `skill.impact-rate`  
**Definition**: Of sessions where a skill was activated (behavior present), what's the session quality score?

**Measurement**:
- Take sessions scored by evaluator
- Split into: skill-activated vs skill-not-activated (for same task type)
- Compare average quality scores between groups

**Target**: Activated sessions score ≥1.5 points higher than non-activated (on 10-point scale)

### Metric 3: `skill.bloat-ratio` (already defined)
**Definition**: % of skills with zero evidence of activation in last 30 days

**Target**: <0.30

## Implementation Plan

1. **Phase 1** (now): Define task-type → skill mapping for top 10 skills
2. **Phase 2**: Build activation detector (grep-based heuristics on session transcripts)
3. **Phase 3**: Run on last 50 evaluated sessions, compute baseline
4. **Phase 4**: Replace usefulness-rate metric in project.md

## Top 10 Skills for Initial Mapping

| Skill | Relevant When | Activation Signal |
|-------|--------------|-------------------|
| coder-edit-discipline | Any edit task | Uses read() before edit(), verifies after |
| verification | Any deliverable task | Reads back files written, runs tests |
| evidence-over-narrative | Any evaluation/report | Cites specific tool outputs |
| budget-before-act | Any delegated task | Checks scope before starting |
| file-safety | Any file-writing task | Reads existing content first |
| structured-plan-writing | Planning tasks | Produces numbered plan with checkboxes |
| obstacle-pivot | Session hits errors | Changes approach after failure |
| task-compliance | Any assigned task | Deliverables match assignment |
| tool-discipline | Any session | No hallucinated paths, correct tool usage |
| baseline-before-change | Any change task | Measures current state first |

## Decision

Replace `skill.usefulness-rate` with `skill.activation-rate` as the primary skill effectiveness metric. The activation-rate is:
- Directly measurable from session transcripts
- Attributable to specific skills (not conflated with infra)
- Actionable (low activation → improve skill delivery/framing)
