# EXP-480: Constraint-Extraction Skill for HARD_CONSTRAINT_VIOLATION

**Date**: 2026-05-10
**Status**: DESIGN
**Target Failure**: HARD_CONSTRAINT_VIOLATION (20 occurrences, 7 agents — #4 system-wide)

---

## Problem

HARD_CONSTRAINT_VIOLATION is the 4th most frequent failure mode (20 occurrences across 7 agents) but has **no dedicated skill or experiment**. Agents violate explicit constraints stated in the task prompt — e.g., "do not modify file X", "use library Y", "output must be format Z". Unlike PATH_HALLUCINATION (coaching-level) or VERIFICATION failures (structural), constraint violations are **attention failures** — the constraint is in the prompt but the agent doesn't extract or track it.

## Hypothesis

**H-480**: A constraint-extraction skill that requires agents to explicitly list all constraints before starting work will reduce HARD_CONSTRAINT_VIOLATION by ≥40% (from baseline).

**H-480-null**: Constraint violations are stochastic attention failures unaffected by explicit extraction (like verify-after-edit per KE-338).

## Skill Design: `constraint-extraction`

```markdown
# Constraint Extraction

## When to use
Before starting ANY task that modifies files or produces output.

## Protocol
1. **EXTRACT**: Read the full task. List every explicit constraint (MUST, MUST NOT, only, never, required format, etc.)
2. **SURFACE**: Write the constraints as a numbered checklist in your first planning output
3. **CHECK**: Before calling finish(), review each constraint against your actual output
4. **CITE**: In finish(), reference which constraints you verified

## Anti-Patterns
- AP-1: "Skim and Start" — beginning work without reading full task → miss constraints buried in middle/end
- AP-2: "Implicit Compliance" — assuming you'll remember constraints without writing them down
- AP-3: "Selective Checking" — verifying easy constraints, skipping hard ones
```

## Method

### Phase 1: Gym Scenario Design
Create scenario `constraint-violation-detection` with:
- A coding task with 4-5 explicit constraints (some obvious, some buried mid-paragraph)
- Success criteria checking whether each constraint is satisfied
- At least one constraint that conflicts with the "natural" way to solve the problem

### Phase 2: Baseline (3 trials, no skill)
- Run scenario 3x without skill
- Target: baseline ≤67% (goldilocks zone — not floor or ceiling)

### Phase 3: Treatment (3 trials, with skill)
- Inject constraint-extraction skill into coaching/my-instructions.md
- Run scenario 3x
- Measure: constraint compliance rate per trial

### Decision Rule
- **≥+20pp improvement** → POSITIVE. Deploy skill to coder + bob.
- **<+20pp or ceiling** → INCONCLUSIVE. Revise scenario or skill.
- **Negative delta** → NEGATIVE. Close. Constraint violations may be ability-bound.

## Success Criteria
1. Gym scenario created with ≥4 explicit constraints and automated checking
2. Baseline in goldilocks zone (33-67%)
3. Treatment shows ≥+20pp improvement over baseline

## Risk Mitigation
- **Ceiling risk**: Include one "buried" constraint (mid-paragraph, not bolded) and one that conflicts with natural approach
- **KE-338 risk**: If text coaching fails (like verify-after-edit), close as NEGATIVE and escalate for structural extraction
- **Floor risk**: Keep task itself simple (not ability-bound like partial-verification-trap)

## Dependencies
- Gym runner: ✅ Available (`GYM_AGENT_BIN=/usr/local/bin/may-agent`)
- Scenario: Needs creation
- Skill file: Needs creation

## Next Steps
1. Create skill file at `agents/shared/skills/constraint-extraction.md`
2. Create gym scenario at `agents/gym/scenarios/constraint-violation-detection/`
3. Run baseline trials
4. Run treatment trials
5. Analyze results
