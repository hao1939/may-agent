# EXP-229: Depth Verification Intervention for Judgment Scenarios

**Author**: Bob
**Date**: 2026-07-28
**Status**: DESIGNED
**Cost Estimate**: ~$6-8 (5 scenarios × 2 arms × 5 runs = 50 runs)

## Motivation

Gym baseline (2026-07-28) shows **75% overall (15/20)**, up from 50% in April. All 5 remaining failures are judgment scenarios where the agent stops at the first "done" signal:

| Scenario | Failure Mode | Pattern |
|----------|-------------|---------|
| silent-data-corruption | Fixes new code, doesn't migrate existing data | Tests pass → ship (misses existing users) |
| approach-validation-trap | Accepts surface conclusion without reading logs | Summary says X → accept (doesn't trace evidence) |
| truncated-schema-migration | Fixes visible test failures, misses silent columns | Tests pass → ship (doesn't cross-reference model) |
| ambiguous-context-drift | Trusts injected context about migration progress | Context says 4/6 done → continue (doesn't verify filesystem) |
| build-activation-gap | Deploys but doesn't verify running process | Deploy script succeeds → ship (doesn't check daemon) |

**Unifying pattern**: Premature completion at the first positive signal without a second-look verification pass.

## Hypothesis

**H-229**: A "second-look" skill that instructs the agent to pause before finish() and check for unstated assumptions will improve pass rates on judgment scenarios by ≥20pp (from ~0% to ≥20%).

**Mechanism**: The agent's failure is not skill (it CAN find the issue) but activation (it doesn't THINK to look). A structured prompt to verify assumptions before shipping should activate the deeper check.

## Design

### Arm A: Baseline (no intervention)
Run each scenario 5 times with the stock agent. Establishes current failure rate.

### Arm B: Second-Look Skill
Add a skill to the agent's context that says:

```
## Pre-Completion Verification (MANDATORY)
Before calling finish(), pause and answer these questions:
1. **Existing data**: Does my change affect data/state that existed BEFORE my changes? Have I verified existing functionality still works?
2. **Untested paths**: Are there code paths my changes interact with that the tests DON'T cover? Read the source to check.
3. **Stated assumptions**: What did the task/context TELL me was true? Have I verified it with actual tool output?
4. **Running state**: If I deployed/changed something, is the LIVE system actually using my changes? Check, don't assume.

If ANY answer reveals a gap, investigate before finishing.
```

### Scenarios (5)
1. silent-data-corruption (targets check #1: existing data)
2. approach-validation-trap (targets check #2/3: untested paths, stated assumptions)
3. truncated-schema-migration (targets check #2: untested paths)
4. ambiguous-context-drift (targets check #3: stated assumptions)
5. build-activation-gap (targets check #4: running state)

### Metrics
- **Primary**: Pass rate per scenario (binary: pass/fail per success_criteria.js)
- **Secondary**: Which specific criteria pass (to see partial improvement)
- **Tertiary**: Tool call count (does the skill add overhead?)

## Predictions

| Scenario | Baseline | Arm B (predicted) | Rationale |
|----------|----------|-------------------|-----------|
| silent-data-corruption | 0% (3/3 fail) | 40% | Check #1 directly targets the failure mode |
| approach-validation-trap | 0% (2/2 fail) | 30% | Requires agent to actually read logs, not just be reminded |
| truncated-schema-migration | ~20% | 40% | Agent sometimes already cross-references |
| ambiguous-context-drift | ~20% | 50% | Check #3 is very direct for this scenario |
| build-activation-gap | ~20% | 40% | Check #4 directly targets the gap |

**Overall predicted improvement**: +20pp average across 5 scenarios.

## Null Result Criteria
If Arm B shows <10pp improvement over baseline across all 5 scenarios, the intervention is insufficient. This would suggest the problem is deeper than activation (possibly model-level reasoning limits per H-099).

## Execution Plan
1. Run Arm A: 5 scenarios × 5 runs = 25 runs (~$3)
2. Build skill file, inject into agent context
3. Run Arm B: 5 scenarios × 5 runs = 25 runs (~$3)
4. Score all runs, compare pass rates
5. Write results

## Dependencies
- Gym infrastructure working (confirmed 2026-07-28)
- Agent: `--agent amy` (confirmed working)
