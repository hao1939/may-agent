# EXP-400: Mid-Session Planning Skill

## Problem Statement
Agents have OUTPUT FORMAT (session-start planning) but no guidance for mid-session re-planning when tasks turn out more complex than expected. Common failure: agent starts a multi-step task, encounters unexpected complexity, and proceeds linearly without adjusting approach — leading to incomplete or low-quality outputs.

## Hypothesis
A "decompose-before-acting" micro-skill (triggered when a task has ≥3 steps or encounters an unexpected blocker) will improve task completion rate by ≥20pp on complex gym scenarios.

## Evidence for Problem
- EXP-261 (partial-verification-trap): agents fix bug but break tests — no mid-course adjustment
- EXP-265 (compound verification): same pattern — linear execution without re-assessment
- Common in production: agents that start well but degrade as session complexity grows

## Skill Design: `decompose-before-acting`
```
When you encounter a task that requires more than 3 sequential steps:
1. PAUSE — list the steps you'll take before starting
2. After each step, CHECK — did the result match your expectation?
3. If not, REPLAN — update your remaining steps before continuing

When you hit an unexpected error or blocker mid-session:
1. STOP — do not immediately retry the same approach
2. DIAGNOSE — what went wrong and why?
3. REPLAN — choose a different approach if the original failed
```

## Method
- **Scenario**: `partial-verification-trap` (baseline: 11% pass rate — confirmed hard)
- **Arms**:
  - A (control): No skill loaded
  - B (treatment): `decompose-before-acting` skill loaded via coaching/my-instructions.md
- **Trials**: 3 per arm (6 total)
- **Success metric**: ≥2/3 treatment trials pass all checks (vs 0-1/3 baseline)
- **Duration**: 1 gym session

## Risks
- KE-338 pattern: text coaching may be dead for execution behavior (EXP-261, 265, 280 all NEGATIVE)
- Mitigation: This is a PLANNING skill (cognitive), not an EXECUTION skill (procedural). Prior failures were all procedural. Planning skills have shown some success (OUTPUT FORMAT +32pp, requirement-conflict-check eliminated catastrophic failures).

## Success Criteria
- Treatment arm: ≥2/3 pass (67%+)
- Control arm: ≤1/3 pass (33% or less, confirming difficulty)
- Delta: ≥+33pp

## Next Steps
1. Write the skill file
2. Create treatment scenario variant
3. Run baseline (3 trials)
4. Run treatment (3 trials)
5. Write results

## Created
2027-09-13
