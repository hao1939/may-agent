# EXP-196: Discovery-Oriented Skill for Relational Bug Blindness

**Status**: DESIGNED
**Created**: 2025-07-19
**Parent**: prove-the-loop (M3→M4)
**Predecessor**: EXP-195 (file skill 0/3, inline skill 0/3, direct hint 4/10)

## Problem

Agents fix value bugs at ~97% but relational/ordering bugs at ~4% (2/50 across EXP-177 + EXP-195). The gap is robust across 50 trials over 3+ weeks. Direct hints work (40%) but aren't transferable. We need a general heuristic the agent can apply to ANY codebase, not just cascading-fix-trap-v2.

## Hypothesis

**If** we teach the agent a "trace data flow before editing" heuristic — prompting it to map how data moves between pipeline stages and check whether the ORDER of operations matters — **then** the pipeline-order-fixed pass rate on cascading-fix-trap-v2 will increase from 4% baseline to ≥25%.

**Mechanism**: The agent currently pattern-matches on broken values and fixes them in isolation. It never asks "does the order these steps run in matter?" A discovery heuristic that triggers this question will cause the agent to notice ordering dependencies and fix them.

## Intervention

### Text (SOUL.md addition — "Data Flow Audit" rule)

```markdown
## Data Flow Audit

When fixing bugs in multi-step pipelines or processing chains:

1. **Map the flow**: Before editing, trace how data moves between stages.
   List each stage and what it consumes/produces.
2. **Check ordering**: Ask — "Does the order these stages execute in affect
   correctness?" If stage B depends on stage A's output, A must run first.
3. **Fix relations, not just values**: After fixing a value bug, re-check
   whether the fix changes what order stages should run in. A "wrong value"
   is often a symptom of "wrong order."
4. **Verify the chain**: After your fix, mentally execute the full pipeline
   in order. Does each stage receive correct input from the previous stage?
```

### Deployment Method

**Primary**: Add the above block to the target agent's SOUL.md (or equivalent system prompt section). This is the lightest-touch deployment — no new files, no inline hints, no scenario-specific knowledge.

**Rationale for SOUL.md over alternatives**:
- File-based skill: 0/3 in EXP-195 — agent didn't retrieve/apply it
- Inline skill: 0/3 in EXP-195 — too verbose, agent ignored it
- SOUL.md rules are always in context and concise enough to not be skipped

## Measurement Protocol

### Design: Pre/Post comparison with synthetic eval runs

| Parameter | Value |
|-----------|-------|
| Scenario | cascading-fix-trap-v2 |
| Primary metric | pipeline-order-fixed pass rate |
| Baseline | 4% (2/50, from EXP-177 N=40 + EXP-195 N=10) |
| Sample size (post) | N ≥ 20 |
| Target | ≥ 25% pass rate |
| Secondary metric | value-bug-fixed pass rate (monitor for regression, expect ≥90%) |

### Statistical Test

One-sided binomial test: H₀: p ≤ 0.04, H₁: p > 0.04.

At N=20:
- 5/20 (25%) → p = 0.0003 vs H₀ (p=0.04). Clearly significant.
- 3/20 (15%) → p = 0.009. Still significant at α=0.05.
- 2/20 (10%) → p = 0.057. Borderline — would need more trials.
- 1/20 (5%) → p = 0.264. Not significant.

**Minimum detectable effect at N=20, α=0.05**: ≥3 passes (15%).

### Procedure

1. Deploy intervention (add Data Flow Audit to SOUL.md)
2. Freeze all other prompt/rule changes during measurement window
3. Run 20 eval trials on cascading-fix-trap-v2
4. Score each trial: pipeline-order-fixed (pass/fail), value-bug-fixed (pass/fail)
5. Compute pass rate and binomial p-value

## Success Criteria

| Outcome | Condition | Action |
|---------|-----------|--------|
| **STRONG SUCCESS** | ≥5/20 (25%+), p < 0.01 | Promote skill to permanent SOUL.md. Proceed to M5-M9. |
| **MODERATE SUCCESS** | 3-4/20 (15-20%), p < 0.05 | Promote provisionally. Extend to N=40 for confirmation. |
| **INCONCLUSIVE** | 2/20 (10%), p ≈ 0.05 | Extend to N=40 before deciding. |
| **FAILURE** | ≤1/20 (≤5%) | Reject. Redesign intervention (consider few-shot examples or structured reasoning template). |

## Regression Guard

If value-bug-fixed drops below 85% (vs 97% baseline), halt the experiment — the intervention is causing harm.

## Fallback Plans

If EXP-196 fails:
- **EXP-197a**: Few-shot version — add a worked example of discovering an ordering bug (not from cascading-fix-trap-v2) to the skill
- **EXP-197b**: Structured output — require the agent to produce a "pipeline order map" artifact before making edits
- **EXP-197c**: Combined approach — SOUL.md rule + lightweight skill file with the worked example
