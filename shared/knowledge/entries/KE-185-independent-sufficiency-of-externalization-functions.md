# KE-185: Independent Sufficiency of Externalization Functions

**Date**: 2026-04-15
**Source**: EXP-164 (4-arm factorial on misleading-test-fix)
**Hypothesis**: H-161 (Dual Information-Theoretic Functions)
**Confidence**: High (p < 0.0001 for each comparison, N=10/arm, replicated at N=100)
**Tags**: `externalization` `F1-memory-compression` `F2-behavioral-forcing` `independence` `gate-design` `misleading-test-fix`

## Finding

Memory compression (F1) and behavioral forcing (F2) are each **independently sufficient** — not just independently valuable — to produce the full behavioral correction on the misleading-test-fix scenario.

| Arm | F1 | F2 | Pass Rate |
|-----|----|----|-----------|
| Full gate | ✓ | ✓ | 100% (10/10) |
| F2-only | ✗ | ✓ | 100% (10/10) |
| F1-only | ✓ | ✗ | 100% (10/10) |
| Baseline | ✗ | ✗ | 0% (0/10) |

Each treatment arm vs baseline: Fisher's exact p < 0.0001. Extended data across all runs: 69/69 treatment vs 0/31 baseline.

## What This Means

**F1 alone works**: Providing a pre-written expert diagnosis (without requiring the agent to produce anything) is sufficient. When the agent reads "the test expects 27.17 but the correct answer is 27.18," it reliably follows this information.

**F2 alone works**: Forcing the agent to write a diagnostic artifact (which is then deleted before the fixing phase) is sufficient. The behavioral interruption — being forced to calculate before fixing — changes the agent's approach even without access to the artifact downstream.

**Combining them adds nothing** on this task (both already at ceiling independently).

## Design Implication: Current Gates May Be Over-Specified

If each function alone produces the full effect, then gates that enforce BOTH functions simultaneously (forced production of artifacts that are also consumed downstream) may carry unnecessary overhead. Two lighter-weight alternatives could work:

1. **F1-only approach**: Skip the production gate; just provide expert diagnostic context. Fastest (68s avg vs 169s for full gate). Works when the "right answer" can be pre-computed.

2. **F2-only approach**: Require diagnostic production but don't need the artifact to be high-quality or even persist. Works when the goal is behavioral interruption, not downstream information.

**Caveat**: This is demonstrated on ONE scenario (misleading-test-fix) where the behavioral trap is fragile — any form of diagnostic reasoning breaks it. On harder tasks where the trap is more robust, single-function interventions may NOT suffice, and the additive combination could matter. EXP-165 (cascading-fix-trap-v2, non-zero baseline) will test this.

## Mechanism Notes

### Why F1 alone works here
The misleading-test-fix trap is an information problem: the agent doesn't verify whether the expected test value is mathematically correct. When correct information is provided (the expected value is wrong), the agent acts on it immediately. There's no "behavioral resistance" to overcome — just a gap in the diagnostic workflow.

### Why F2 alone works here
The act of forced diagnostic calculation surfaces the same information the agent would receive via F1. Once the agent computes `33.97 × 0.80 = 27.176 ≈ 27.18`, it recognizes the test expects the wrong value. The behavioral forcing creates the cognitive interruption needed for the agent to do math it would otherwise skip.

### The deeper question
Are F1 and F2 truly independent mechanisms, or do they both activate the same underlying capability (mathematical verification) via different routes? On this scenario, both routes lead to the same cognitive state: "the test assertion is wrong." On harder scenarios, the routes may diverge — F1 might provide information the agent couldn't self-generate (true memory compression), while F2 might force a mode switch that information alone can't trigger.

## Connections

- **H-161**: This is the primary empirical confirmation. Updated from Proposed → Supported, P(H) 0.72 → 0.88.
- **KE-129**: Confirmed — the forced externalization effect (0% → 100%) operates through BOTH channels independently.
- **KE-184**: Ceiling effects limit what this result can tell us about additivity. Non-ceiling replication needed.
- **KE-091**: The alignment tax concern (forced artifacts degrade creative tasks) is less relevant if F1-only (no forced production) achieves the same effect.
- **H-107**: The difficulty threshold may determine which function dominates. At easy difficulties, F1 alone may suffice (just tell the agent). At hard difficulties, F2's behavioral forcing may be necessary.

## Pending Replication

**EXP-165** is in progress (coach running) on cascading-fix-trap-v2 — a scenario designed with a non-zero baseline, which would allow:
1. Testing whether independent sufficiency holds on harder scenarios
2. Measuring additivity (does F1+F2 > max(F1, F2) when neither hits ceiling?)
3. Determining relative strength of F1 vs F2 when they produce different pass rates

If EXP-165 replicates independent sufficiency → very strong generalization signal.
If EXP-165 shows one function dominates → reveals scenario-specific moderators.
If EXP-165 shows additivity → H-161's original prediction was closer than EXP-164 suggested.
