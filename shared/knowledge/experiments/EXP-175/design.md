# EXP-175: Improving Scout Analysis Quality for Two-Phase Debugging

**Date**: 2026-04-16
**Status**: CONCLUDED (null result — floor effect, see results.md)
**Predecessor**: EXP-174 (0/37 scout→coder, confirmed genuine quality gap)

---

## Research Question

Can a process skill force scout to produce causally-specific analysis that crosses the recognition threshold for coder?

EXP-174 confirmed scout→coder gets 0% on cascading-fix-trap-v2 with clean environments, while moderate human hints get 100%. The gap is **causal specificity**: scout describes symptoms ("tests fail", "grades are wrong") but doesn't identify the root cause mechanism (pipeline ordering). A human hint saying "normalize before penalties" is enough for 100%. The question is whether we can train scout to produce that level of causal specificity.

## Hypothesis

- **H-175a (Process skill bridges gap)**: A root-cause-isolation process skill (hypothesis→test→confirm loop) raises scout→coder pass rate to ≥60%. Process skills are the most effective intervention type (KE-021).
- **H-175b (Template suffices)**: A structured output template requiring a "mechanism" field achieves ≥40%. Forcing the right output shape may induce causal reasoning.
- **H-175c (Instructions alone fail)**: Explicit "identify WHY not WHAT" instruction achieves ≤20%. Text rules don't fix judgment failures (KE-002).
- **H-175-null**: No intervention raises pass rate above 20%. The recognition gap is fundamental and cannot be bridged by prompt-level interventions.

## Predictions

| Arm | Predicted pass rate | Rationale |
|-----|-------------------|-----------|
| A (baseline) | 0% | Reuse EXP-174 data (0/37) |
| B (process skill) | 40-80% | Process skills are most effective (KE-021); hypothesis-test loop forces deeper investigation |
| C (template) | 20-50% | Structure may help but doesn't guarantee the agent actually tests hypotheses |
| D (instruction) | 0-20% | Text rules rarely change behavior (KE-002) |

Key discriminating outcomes:
- B ≥ 60% and D ≤ 20% → Process enforcement matters, not just awareness
- B ≈ C ≈ D ≈ 0% → Recognition gap is fundamental, no prompt intervention works
- C ≥ B → Structure matters more than process (surprising, would revise KE-021)

## Design

### Arms

| Arm | Intervention | N | Scenario variant |
|-----|-------------|---|-----------------|
| A | None (baseline) | 0 (reuse EXP-174: 0/37) | `exp172-scout-coder` |
| B | Root-cause-isolation skill | 10 | `exp175-arm-b` |
| C | Structured template with mechanism field | 10 | `exp175-arm-c` |
| D | "Identify WHY not WHAT" instruction | 10 | `exp175-arm-d` |

Total new trials: 30 (reusing 37 baseline trials from EXP-174).

### Arm B: Root-Cause-Isolation Skill (Process)

A skill file loaded into scout's context that enforces a hypothesis→test→confirm loop:

```
## Root Cause Isolation Process

When investigating a bug, do NOT just describe what's failing. Follow this loop:

1. HYPOTHESIZE: State a specific causal mechanism ("X causes Y because Z")
2. TEST: Run a command that would produce different output depending on whether your hypothesis is true
   - Add logging, check execution order, inspect intermediate values
3. CONFIRM or REJECT: Based on the test output, confirm or reject the hypothesis
4. REPEAT until you have a confirmed root cause with evidence

Your analysis MUST include:
- The confirmed root cause mechanism (not symptoms)
- The evidence that confirmed it (specific tool output)
- The exact fix needed (not "investigate further")

A good root cause: "normalize() runs after penalties() in pipeline.js line 47, so penalty calculations use raw scores instead of normalized ones"
A bad root cause: "the grades are calculated incorrectly"
```

### Arm C: Structured Output Template

Scout must produce analysis in this exact format:

```
## Analysis Output

### Symptoms
[What tests fail and how]

### Mechanism  
[WHY do the symptoms occur? What is the causal chain? e.g., "Function A calls B before C, so B operates on stale data"]

### Root Cause Location
[Exact file, line, and code that needs to change]

### Recommended Fix
[Specific code change, not vague advice]
```

### Arm D: Explicit Instruction

Add to scout's task prompt:
> "IMPORTANT: Your analysis must identify WHY the bug occurs, not just WHAT symptoms you observe. Describe the causal mechanism. The coder who receives your analysis has never seen this codebase — they need to understand the root cause to fix it."

### Scenario Setup

Each arm uses cascading-fix-trap-v2 with clean environment (verified per EXP-174 protocol). The only difference is what's loaded into scout's context/instructions before investigation.

### Environment Verification (before running)

Same checklist as EXP-174:
1. `pipeline.js`: normalize (Step 3) before penalties (Step 4) — bug present
2. `grades.js`: no `>=` contamination
3. `penalties.js`: no `pct` field contamination

### Execution Plan

```bash
# For each arm B, C, D: run 10 trials
for arm in b c d; do
  for i in $(seq 1 10); do
    bash scripts/gym-run.sh exp175-arm-${arm} --timeout 600 &
    sleep 2
  done
  wait
done
```

## Metrics

**Primary**: Binary pass/fail (all tests pass + pipeline-order-fixed)

**Secondary** (qualitative, sample 3 per arm):
- Does scout's analysis mention pipeline ordering?
- Does scout's analysis identify the specific causal mechanism?
- Does scout test hypotheses (run diagnostic commands)?
- Quality of handoff document (would a human find it actionable?)

## Analysis Plan

1. Pass rates per arm with 95% CI (Wilson interval)
2. Fisher's exact test: B vs A, C vs A, D vs A
3. Qualitative coding of scout analysis documents (3 per arm)
4. If B > 0%: examine what the skill caused scout to do differently (trace analysis)

## Power Analysis

With N=10 per arm and baseline of 0%:
- Detectable effect: ≥30% pass rate (3/10) gives p<0.05 vs 0/37 baseline (Fisher's exact)
- If true effect is 60%: P(≥3/10) = 95% — adequate power
- If true effect is 30%: P(≥3/10) = 62% — marginal power, may need follow-up

## Risk: Stacking Interventions (KE-123)

Each arm uses exactly ONE intervention. No stacking.

## Risk: Completion Illusion (KE-180)

The skill in Arm B gates on producing a confirmed root cause with evidence, not on writing a report. The template in Arm C requires mechanism identification, not just filling in fields.

## Dependencies

- Clean scenario environments (copy from EXP-174 base)
- Skill file for Arm B: `agents/.lab/exp175-arm-b/skills/root-cause-isolation.md`
- Template for Arm C: embedded in scenario scout instructions
- Instruction for Arm D: embedded in scenario scout instructions

## Expected Timeline

- Setup: 15 min (create 3 scenario variants)
- Execution: ~30 min (30 trials)
- Analysis: 15 min
