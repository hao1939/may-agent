# KE-401: Judgment Failure Taxonomy — Activation Gaps vs Reasoning/Conceptual Gaps

**Date**: 2026-07-29
**Source**: EXP-229 (Second-Look Verification Intervention)
**Confidence**: Medium (N=3 per arm per scenario, 4 scenarios)

## Finding

Not all judgment failures respond to the same intervention. EXP-229 tested a 4-question pre-completion checklist on 4 consistently-failing scenarios:

- **Activation gap** (agent CAN do it, doesn't think to): Checklist fixes it. silent-data-corruption went 0% → 100%.
- **Reasoning chain gap** (needs multi-step evidence trace): Checklist insufficient. approach-validation-trap stayed 0%.
- **Conceptual gap** (agent lacks domain mental model): Checklist insufficient. build-activation-gap stayed 0%.

## Taxonomy

| Type | Description | Checklist works? | Better intervention |
|------|-------------|-----------------|---------------------|
| Activation gap | Agent has the skill, needs a trigger | ✅ Yes | Reminder/checklist |
| Reasoning chain gap | Agent needs multi-step trace | ❌ No | Structured reasoning workflow |
| Conceptual gap | Agent lacks domain model | ❌ No | Domain knowledge injection |

## Implication

Before designing an intervention, classify the failure type. Checklists only fix activation gaps (~25% of judgment failures in our corpus). For reasoning/conceptual gaps, different approaches are needed.

## Gym Impact

Baseline improved from 80% → 85% (16/20 → 17/20) by deploying the second-look skill for activation-gap scenarios.
