# EXP-249: Capability-Structured Evaluator Prompt

**Date**: 2028-07-29
**Status**: DESIGNED
**Hypothesis**: H-207b — Per-capability evaluation produces more actionable feedback than holistic scoring
**Builds on**: EXP-248 pilot (capability attribution is consistent)

## Problem

Current evaluator produces a flat quality/efficiency score with a list of issues. This doesn't tell coaching *what capability to train*. A session might fail for 3 different reasons — verification, environment-awareness, planning — but the current output just says "needs_improvement" with a narrative.

## Intervention: Capability Dimensions Addendum

Add a structured section to the evaluator prompt that asks explicit per-capability questions AFTER the holistic score. This preserves backward compatibility while adding actionable decomposition.

### Prompt Addendum (insert after "### Evidence Hierarchy")

```markdown
## Capability Decomposition (required for needs_improvement verdicts)

When a session scores needs_improvement, decompose the failure into capability dimensions. For each dimension, answer the specific questions and rate PASS / PARTIAL / FAIL.

### 1. Tool-Use
- Did the agent select appropriate tools for the task?
- Were parameters formed correctly (paths, flags, schemas)?
- Did tool calls succeed on first attempt, or were there parameter errors?
Rating: [PASS | PARTIAL | FAIL]

### 2. Environment-Awareness
- Did the agent know what tools/files/paths are available?
- Did it hallucinate capabilities that don't exist?
- Did it orient (ls/read) before acting, or guess blindly?
Rating: [PASS | PARTIAL | FAIL]

### 3. Verification
- After writes/edits, did the agent read back to confirm?
- After multi-step operations, did it check the final state?
- Did it catch its own errors, or leave them for review?
Rating: [PASS | PARTIAL | FAIL]

### 4. Planning
- Did the agent sequence steps logically?
- Did it stop and reassess when something failed?
- Did it manage scope (not spiral into unrelated work)?
Rating: [PASS | PARTIAL | FAIL]

### 5. Memory/Context
- Did the agent use instructions from its SOUL/context?
- Did it follow provided patterns vs. inventing new ones?
- Did it retain information from earlier in the session?
Rating: [PASS | PARTIAL | FAIL]

Output format:
```
CAPABILITY_DECOMPOSITION:
- tool_use: [PASS|PARTIAL|FAIL] — <one-line evidence>
- environment_awareness: [PASS|PARTIAL|FAIL] — <one-line evidence>
- verification: [PASS|PARTIAL|FAIL] — <one-line evidence>
- planning: [PASS|PARTIAL|FAIL] — <one-line evidence>
- memory_context: [PASS|PARTIAL|FAIL] — <one-line evidence>
PRIMARY_FAILURE: <dimension with most impact>
COACHING_TARGET: <specific skill/behavior to improve>
```
```

## Test Protocol

1. **Sample**: 5 recent `needs_improvement` sessions (diverse agents)
2. **Control**: Current evaluator output (already exists for these sessions)
3. **Treatment**: Re-evaluate same sessions with capability addendum
4. **Comparison metrics**:
   - Does treatment identify a clear PRIMARY_FAILURE? (vs control's flat list)
   - Does COACHING_TARGET map to an existing skill/intervention?
   - Inter-rater: Would a second evaluator reach same PRIMARY_FAILURE?

## Success Criteria

- ≥4/5 sessions get a PRIMARY_FAILURE that maps to a coachable capability
- COACHING_TARGET is specific enough to select an intervention (not just "be better")
- No regression in holistic score accuracy (capabilities don't distract from overall judgment)

## Cost

~$2-3 for 5 re-evaluations. Zero infra changes needed for test — just modify prompt text for treatment runs.

## Next Steps

1. Find 5 recent needs_improvement sessions
2. Run treatment evaluations manually (copy prompt + addendum + transcript)
3. Compare outputs, write results
4. If successful → brief tech-lead for SOUL.md integration

## Connection to System

This directly feeds the coaching loop:
- Coach currently gets "session X was bad" → tries to figure out what to train
- With this: Coach gets "session X failed on verification + environment-awareness" → applies verify-after-edit skill + orientation skill
- Closes the gap between evaluation and intervention
