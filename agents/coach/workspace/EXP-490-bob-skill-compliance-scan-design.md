# EXP-490: Bob Skill Compliance Scan

**Date**: 2028-07-28
**Status**: DESIGN
**Author**: coach
**Priority**: P1
**Predecessor**: EXP-305 (skill pruning audit)

## Problem

Bob has 13 active skills after EXP-305 demoted 3 (obstacle-pivot, verify-after-edit, diagnosis-before-action). Of the remaining 13, **8 have "Unknown" impact** per EXP-305 inventory. We're paying context-window cost for skills that may have zero compliance.

## Hypothesis

**H490**: At least 3 of the 8 "Unknown" skills show <10% compliance in bob's recent sessions and can be safely demoted, reducing context noise.

## Target Skills (Unknown Impact)

| # | Skill | Target Behavior |
|---|-------|----------------|
| 1 | cross-reference-source-code | Grep source before config repair |
| 2 | evidence-over-narrative | Use data not stories |
| 3 | know-when-blocked | Escalate vs spin |
| 4 | persistent-task-workflow | Multi-session task tracking |
| 5 | plan-once-amend | Don't re-plan constantly |
| 6 | state-check-before-action | Check state first |
| 7 | verification | General verification |
| 8 | verify-before-finish | Check work before finish |

## Methodology

### Phase 1: Session Audit
- Collect 10+ recent bob sessions (any type)
- For each skill, define a detectable compliance signal:
  - `cross-reference-source-code`: grep/rg command before config edit
  - `evidence-over-narrative`: finish() cites specific tool outputs
  - `know-when-blocked`: escalation/notification when stuck >3 attempts
  - `persistent-task-workflow`: references to prior session state
  - `plan-once-amend`: single PLAN block without full re-planning
  - `state-check-before-action`: reads state/status before mutations
  - `verification`: any post-edit verification
  - `verify-before-finish`: explicit check before finish() call

### Phase 2: Score
- Per skill: count sessions where signal is present / sessions where skill was applicable
- Applicable = session involved a task where the skill would activate

### Phase 3: Decide
- <10% compliance + no measured positive impact → DEMOTE
- 10-50% compliance → RE-TEST in gym (design scenario)
- >50% compliance → KEEP

## Success Criteria
- All 8 skills scored
- ≥2 clear prune/keep decisions
- Results documented with evidence

## Connection to Prior Work
- EXP-305: Inventory + first 3 demotions
- KE-338: Text coaching limits (compliance < 10% = skill is dead)
- EXP-280, EXP-350: verify-after-edit confirmed dead via 6 experiments
