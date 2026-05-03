# KE-645: Cognitive Skills Also Fail in Production Without Structural Gates

## Date: 2029-07-27
## Source: EXP-645 (Impact Radius Check Production Audit)
## Extends: KE-480 (Text Coaching Dead for Verification Behaviors)

## Finding

Even **cognitive** skills (reasoning patterns, not just procedural actions like verify-after-edit) fail to transfer from gym to production without structural enforcement.

## Evidence

| Skill | Gym Effect | Production Rate | Delta |
|-------|-----------|----------------|-------|
| impact-radius-check | +100pp (EXP-445, EXP-570) | 6% (EXP-645) | Near-zero transfer |
| verify-after-edit | +100pp (EXP-565 threat) | 9-13% (EXP-280, 580) | Near-zero transfer |
| diagnose-before-retry | 0pp (EXP-600) | Not measured | Gym itself showed no effect |

## Mechanism

1. **Gym**: Skill explicitly loaded in coaching prompt + focused single task + unlimited time → agent CAN perform behavior
2. **Production**: Worker task prompt dominates, time pressure, context.md skills are background noise → agent DEFAULTS to minimal path

## Implication

**The gym measures capability ceiling, not production behavior.**

A skill passing in gym means the agent *can* do it. It does NOT mean the agent *will* do it in production. The gap is:
- Priority (task prompt > context.md skills)
- Attention (too many competing instructions)
- Habit (agents default to "fix target, move on")

## Prescription

1. **For behaviors you need in production**: Use structural gates (auto-check, re-prompt). Text skills will NOT work.
2. **For gym validation**: Gym proves a skill *could* help. Then you still need structural enforcement to make it *actually* help.
3. **For experiment design**: Don't close an experiment at "gym positive." That's only step 1. Production measurement (EXP-645 style) is required.

## Extended KE-480 Classification

| Intervention Type | Gym Effect | Production Effect | Example |
|-------------------|-----------|-------------------|---------|
| Text awareness nudge | 0pp | 0pp | EXP-625 |
| Text threat framing | +100pp | Unknown (EXP-565 deployed, unmeasured) | EXP-560 |
| Cognitive skill (text) | +33-100pp | ~0pp | EXP-445→645 |
| Structural gate | +100pp | +100pp (EXP-500, 520, 530) | EXP-500 |

## Status: WRITTEN ✅
