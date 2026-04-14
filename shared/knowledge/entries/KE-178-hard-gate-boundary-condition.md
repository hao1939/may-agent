# KE-178: Hard Gate Boundary Condition — Low Baseline + Step-Skipping Required

**Status**: VALIDATED
**Source**: EXP-156 (Hard Gate Generalization), EXP-155, EXP-127
**Date**: 2026-04-14
**Confidence**: High (4 scenarios, N=62 total runs)

## Finding

Ch2 hard externalization gates produce dramatic improvements (+85 to +100pp) **only when two conditions are met**:

1. **Low baseline** (≤ 50%): The agent fails most of the time without intervention
2. **Step-skipping failure mode**: The agent's failure is caused by skipping an analytical step that, if performed, makes the correct action obvious

When either condition is absent, hard gates provide no benefit and may cause regression.

## Evidence

| Scenario | Baseline | Treatment | Δ | Failure Mode | Both Conditions? |
|----------|----------|-----------|---|-------------|-----------------|
| contradictory-requirements | 0% | 100% | +100pp | Skips contradiction analysis | ✅ Yes |
| hidden-dep | 15% | 100% | +85pp | Skips investigation | ✅ Yes |
| misleading-test-fix | 0% | 100% | +100pp | Skips math verification | ✅ Yes |
| ambiguous-context-drift | 90% | 70% | -20pp | Trusts injected context | ❌ No (high baseline, belief-based) |

## Mechanism

The hard gate works by:
1. **Forcing the skipped step** to occur (mandatory artifact creation with existence check)
2. **Making the answer visible** — once the agent writes the analysis, the correct action becomes obvious
3. **Phase boundary enforcement** — the gate prevents acting before analyzing

This explains why it fails for context-drift: the agent isn't skipping a step. It's making a belief error (trusting false context). A verification artifact can't fix a belief problem — the agent may write the verification and still believe the context.

## Practical Guidance

- ✅ **Apply hard gates when**: Baseline ≤ 50% AND failure is "agent rushes to act without analyzing"
- ❌ **Don't apply when**: Baseline > 50% (ceiling effect), or failure is belief/judgment-based rather than process-based
- ⚠️ **Check baseline first**: Always measure baseline before designing a hard gate intervention (see KE-010)

## Connection

- Extends **KE-129** (Ch2 only reliable channel): Hard gates are reliable but bounded
- Extends **KE-010** (ceiling check): Not just ceiling — also check failure mode type
- Related to **KE-025** (instruction overhead): Hard gates on high-baseline scenarios add overhead without benefit
