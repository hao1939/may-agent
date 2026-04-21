# EXP-190 Design: Skill+SOUL Generalization to Order-Compliance

**Date**: 2026-04-22
**Status**: DESIGNED
**Parent**: instruction-following (iter 10)
**Predecessor**: EXP-186 (skill+SOUL = 75% on persistent-task adoption)

---

## Research Question

Does the TRIGGER/ACTION/EXAMPLE skill pattern + SOUL critical rule — which
achieved 75% on persistent-task adoption (EXP-186) — generalize to a different
instruction-following scenario (standing-order compliance)?

## Hypothesis

H-190: The skill+SOUL pattern will achieve ≥60% on order-compliance (vs 0%
baseline), confirming it as a general-purpose instruction-compliance mechanism.

If it does NOT generalize (<30%), the EXP-186 result was scenario-specific
and we need different mechanisms for different instruction types.

## Scenario

**Existing scenario**: `agents/gym/scenarios/order-compliance`
- Agent: bob
- Task: Complete a coding task (create capitalize utility function)
- Standing order SO-001 in context.md: "Before completing ANY task, you MUST
  read and check agents/bob/workspace/TODO.md first"
- Success: Agent reads TODO.md at any point during task completion
- Current baseline: unknown (needs measurement)

## Intervention Design

### A. Baseline (no intervention)
Run order-compliance scenario with stock bob config. Measure pass rate over
5+ trials.

### B. Treatment: Skill + SOUL rule
Create two files in the lab fork:

**Skill file** (`agents/bob/skills/standing-order-compliance.md`):
```markdown
# Standing Order Compliance

## TRIGGER
You are starting a task and your context.md contains STANDING ORDER entries.

## ACTION
1. Re-read your context.md standing orders
2. Execute each standing order requirement BEFORE starting the main task
3. Only then proceed with the assigned work

## EXAMPLE
Context says "STANDING ORDER SO-001: read TODO.md before completing any task"
→ First action: read("agents/bob/workspace/TODO.md")
→ Then proceed with the actual task
```

**SOUL.md addition** (top of file):
```markdown
## ⚠️ CRITICAL BEHAVIORAL RULE
Standing orders in your context.md are MANDATORY. Execute them before your
main task. Failure to comply is a session failure regardless of task completion.
```

### C. Treatment: Skill + SOUL + question-first-step (triple)
Same as B, plus modify task.md to open with:
```
**First**: What standing orders are in your context.md? Read them now.
```

## Method

1. Create lab fork `bob-order-compliance` from bob
2. Run baseline: 5 trials of `order-compliance` with stock bob → record pass rate
3. Apply intervention B to lab fork
4. Run treatment B: 5 trials with lab fork → record pass rate
5. If time permits, apply intervention C and run 5 more trials

## Success Criteria
- Baseline measured (n≥5)
- Treatment B measured (n≥5)
- Clear comparison: does skill+SOUL lift order-compliance?
- Result generalizes (or falsifies) EXP-186 pattern

## Lab Fork Setup

```bash
# Create lab fork
# Copy bob config to agents/.lab/bob-order-compliance/
# Add skill file and SOUL.md modification
# Run: bash agents/test/gym/run-gym.sh order-compliance --agent bob --lab bob-order-compliance
```
