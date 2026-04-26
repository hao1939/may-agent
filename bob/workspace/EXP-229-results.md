# EXP-229 Results: Depth Verification Intervention

**Date**: 2026-07-28
**Status**: COMPLETED

## Summary

The "Second-Look Verification" skill (4-question pre-completion checklist) was tested on 4 consistently-failing judgment scenarios. **One scenario showed dramatic improvement (0% → 100%), three showed zero improvement.**

## Results

| Scenario | Baseline (Arm A) | Treatment (Arm B) | Change |
|----------|-------------------|-------------------|--------|
| silent-data-corruption | 0/3 (0%) | **3/3 (100%)** | **+100pp** ✅ |
| approach-validation-trap | 0/3 (0%) | 0/3 (0%) | 0pp |
| truncated-schema-migration | 0/3 (0%) | 0/3 (0%) | 0pp |
| build-activation-gap | 0/3 (0%) | 0/3 (0%) | 0pp |

**Bonus finding**: ambiguous-context-drift now passes 3/3 without any intervention (was failing in the initial single-run baseline on 2026-07-28). Likely improved by recent model/agent changes.

## Updated Gym Scorecard (20 scenarios)

- **Before EXP-229**: 16/20 = 80% (ambiguous-context-drift was already passing)
- **With skill deployed**: 17/20 = 85% (silent-data-corruption fixed)
- **Remaining failures**: approach-validation-trap, truncated-schema-migration, build-activation-gap

## Analysis

### Why silent-data-corruption responded
The skill's **Question #1 ("Existing Data & State")** directly targets this scenario's failure mode: the agent changes a data format but forgets to handle existing persisted data. The question "Does my change affect data that existed BEFORE my changes?" is a precise activation trigger.

### Why the other 3 didn't respond
The other scenarios require more than a reminder checklist:

- **approach-validation-trap**: Requires the agent to actively distrust a summary file and trace evidence through session logs. The skill says "read the raw evidence" but the agent still doesn't do the multi-step evidence trace (read summary → doubt it → find logs → read them → find discrepancy). This is a multi-step reasoning chain, not an activation gap.

- **truncated-schema-migration**: Requires cross-referencing model code against schema. The skill says "read the source code" but the agent needs to realize WHICH source file matters and trace column references. Again, multi-step reasoning.

- **build-activation-gap**: Requires understanding the deploy → activate → verify lifecycle. The skill says "check the running process" but the agent doesn't connect deploying (symlink) to activating (restart daemon). Conceptual gap, not just a reminder gap.

### Taxonomy of judgment failures

| Type | Description | Intervention | Example |
|------|-------------|-------------|---------|
| **Activation gap** | Agent CAN do it, just doesn't think to | ✅ Checklist works | silent-data-corruption |
| **Reasoning chain gap** | Agent needs multi-step evidence trace | ❌ Checklist insufficient | approach-validation-trap |
| **Conceptual gap** | Agent lacks domain mental model | ❌ Checklist insufficient | build-activation-gap |

## Recommendations

1. **Ship the skill for activation-gap scenarios**: The second-look skill should be deployed to production agents. It fixes silent-data-corruption and likely helps with similar "forgot to check existing state" failures.

2. **Different interventions needed for reasoning/conceptual gaps**: 
   - approach-validation-trap: Needs a "evidence hierarchy" skill that teaches distrust of summaries
   - truncated-schema-migration: Needs a "cross-reference" skill that teaches systematic code tracing
   - build-activation-gap: Needs a "deployment lifecycle" domain model

3. **Updated gym baseline**: 17/20 = 85% with the skill deployed.

## Raw Data Location
- Baseline: `agents/bob/workspace/exp229-baseline/`
- Treatment: `agents/bob/workspace/exp229-treatment/`
- Skill: `agents/bob/workspace/exp229-second-look-skill.md`
- Modified scenarios: `agents/gym/scenarios/*-exp229/` (can be cleaned up)

## Hypothesis Resolution
**H-229: PARTIALLY CONFIRMED**. The second-look skill improves pass rates on activation-gap scenarios (silent-data-corruption: +100pp) but has no effect on reasoning-chain or conceptual-gap scenarios. The +20pp average prediction was approximately correct (+25pp across 4 scenarios).
