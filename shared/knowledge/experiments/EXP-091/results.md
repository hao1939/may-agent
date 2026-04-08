# EXP-091: Few-Shot Skill Conversion Sprint 2 — investigate-and-fix — Results

**Date**: 2026-04-08
**Status**: COMPLETE
**Hypothesis**: H-091 (P(H)=0.98) — matched few-shot examples improve skill performance
**Verdict**: ✅ CONFIRMED — Few-shot worked example fixes the reproduce-first gap (0%→100%)

## Summary

Added a domain-matched few-shot worked example to the `investigate-and-fix` skill showing the reproduce-first pattern. The critical `reproduce-first` check went from 0/3 (control) to 3/3 (treatment), and overall process score improved from 4/5 to 5/5 in every run.

**This is the first evidence that few-shot works for process discipline skills, not just judgment skills.**

## Raw Results

### Scenario: investigate-fix-pattern

**Task**: Fix `/api/users/:id` endpoint that crashes on some user IDs. Requires reading `db.js` to discover legacy format (email in `profile.email` instead of `email`) and null email records. Tests require: legacy email handling, null email handling, 404 for invalid IDs, plus 5 behavioral process checks.

### Control (no few-shot, N=3)

| Run | Product | Process | reproduce-first | Overall |
|-----|---------|---------|-----------------|---------|
| Control 1 | 4/4 | 4/5 | ❌ | PASS (4/5 process meets ≥3 threshold) |
| Control 2 | 4/4 | 4/5 | ❌ | PASS |
| Control 3 | 4/4 | 4/5 | ❌ | PASS |

**Control reproduce-first pass rate**: 0/3 (0%)
**Avg process checks**: 4.0/5 (80%)
**Consistent failure**: Agent reads source files (server.js, db.js) then goes straight to editing. Never runs `node test.js` before making changes. This matches EXP-019 baseline exactly (0/4 reproduce-first over N=4).

### Treatment (few-shot injected, N=3)

| Run | Product | Process | reproduce-first | Overall |
|-----|---------|---------|-----------------|---------|
| Treatment 1 | 4/4 | 5/5 | ✅ | PASS |
| Treatment 2 | 4/4 | 5/5 | ✅ | PASS |
| Treatment 3 | 4/4 | 5/5 | ✅ | PASS |

**Treatment reproduce-first pass rate**: 3/3 (100%)
**Avg process checks**: 5.0/5 (100%)
**Behavior change**: In all 3 runs, agent ran `node test.js` BEFORE making any edits, saw the actual failure pattern, then proceeded to investigate and fix with full understanding.

### Effect Size

| Metric | Control | Treatment | Δ |
|--------|---------|-----------|---|
| reproduce-first pass rate | 0% (0/3) | 100% (3/3) | **+100pp** |
| Avg process score | 80% (4/5) | 100% (5/5) | **+20pp** |
| Product correctness | 100% (4/4) | 100% (4/4) | 0 (ceiling) |
| Overall scenario pass | 3/3 | 3/3 | 0 (both pass, but treatment has higher quality) |

## Analysis

### What the worked example did

The injected few-shot example showed a structurally parallel scenario: an API endpoint crashing on some IDs due to inconsistent data formats. The example explicitly demonstrated:

1. **Running tests FIRST** — before touching any code
2. **Why reproduce-first mattered** — the test output revealed 2 failures (not 1), pointing to a data layer issue
3. **Reading the data layer** — finding the inconsistent schema was the root cause
4. **Fixing with full understanding** — one surgical edit addressing all three cases

The example was domain-matched (API endpoint, crash on some IDs, inconsistent data format) but used different names/details (products/pricing vs users/email) to avoid being a direct answer.

### Why few-shot worked where text rules didn't

EXP-019 showed that the investigate-and-fix skill as text rules (Step 2: "Reproduce / Confirm the Issue") had zero effect on reproduce-first behavior. The text rule says WHAT to do but doesn't create a strong enough behavioral trigger.

The few-shot example works because:
1. **It shows the SEQUENCE** — test → read data → understand → fix → verify — as a narrative the agent can follow
2. **It shows WHY reproduce-first matters** — the test output changed the engineer's diagnosis (found 2 failures, not 1)
3. **It's structurally matched** — the scenario is close enough that the agent recognizes "this is the same type of problem, I should follow the same approach"

### Implication: Few-shot works for process discipline too

Previous results (EXP-090) showed few-shot works for judgment skills (deciding WHAT to do). This experiment shows it also works for process skills (deciding WHEN to do it). The reproduce-first gap is a process discipline issue — the agent skips a step it knows it should do. The worked example created a strong enough pattern match to enforce the step ordering.

This is significant because:
- **H-091 scope expands**: Originally validated for judgment tasks only, now confirmed for process discipline
- **Text rules: 0/7 on reproduce-first** (4 from EXP-019 + 3 from this control arm)
- **Few-shot: 3/3 on reproduce-first** (this experiment)
- **Workflow: 2/2 on reproduce-first** (EXP-019 workflow arm)

Few-shot achieves the same result as workflow enforcement but with much lighter weight — no 2-phase separation needed.

## Combined Sprint 1+2 Results (EXP-090 + EXP-091)

| Skill | Type | Control | Treatment | Δ |
|-------|------|---------|-----------|---|
| know-when-blocked | Judgment | 0/3 scenario pass | 3/3 scenario pass | +100pp |
| evidence-over-narrative | Judgment | 0/3 scenario pass | 3/3 scenario pass | +100pp |
| investigate-and-fix | Process | 0/3 reproduce-first | 3/3 reproduce-first | +100pp |

**Cumulative: 9/9 treatment runs passed the target check (100%), vs 0/9 control runs (0%)**

## Cross-References

- **EXP-019**: Original investigate-and-fix experiment (text = 0/4, workflow = 2/2)
- **EXP-090**: Sprint 1 results (know-when-blocked + evidence-over-narrative, both 0%→100%)
- **H-091**: Matched few-shot = near-100% (now P(H)=0.99 with additional process skill evidence)
- **KE-059**: Two-level transfer model (Level 2: structurally matched = ~100%)
- **Bob's conversion plan**: investigate-and-fix was originally listed at #3 priority

## Next Steps

1. Update H-091 P(H) from 0.98 to 0.99 — additional domain (process discipline) confirmed
2. Proceed to Sprint 3: read-before-edit (#3 in conversion plan) and verify-before-finish (#4)
3. Consider: can few-shot replace workflow enforcement? Same effect size (100%) but lighter weight
4. Deploy updated investigate-and-fix SKILL.md to production agents
