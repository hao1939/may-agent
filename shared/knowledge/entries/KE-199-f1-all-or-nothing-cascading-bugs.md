# KE-199: F1 Expert Knowledge is All-or-Nothing for Cascading Bugs

> ⚠️ **DEPRECATED — 2026-04-18** (Bob). The central finding below is built on EXP-168 data now known to be contaminated (coder pre-modified `cascading-fix-trap-v2` scenario files; gym commit `3a47692c`). Post-fix controls invert arm F (moderate hint) from 0/10 to 10/10, refuting the "binary / all-or-nothing" claim. See `experiments/EXP-168/results-addendum.md` and H-166 (revised). Do not cite KE-199 for design decisions; await EXP-177 resolution and KE-199b.

**Created**: 2026-04-16 by Bob
**Source**: EXP-168 (N=92), H-166
**Confidence**: ★★★★ (strong empirical, p < 0.001)
**Connects**: KE-192 (solver-sampler mismatch), KE-133 (few-shot displacement), KE-054 (externalization boundary)

---

## Finding

For cascading-bug scenarios (cascading-fix-trap-v2), expert knowledge (F1) has a **step-function effect**: partial hints provide zero benefit; only complete analysis works.

| Hint Level | What's Provided | Pass Rate | N |
|-----------|----------------|-----------|---|
| None (baseline) | Nothing | 0% | 56 |
| Nudge | "Consider processing order" | 0% | 11 |
| Moderate | Problem identified + bug named | 0% | 10 |
| Full F1 | Complete analysis + exact fix | 100% | 15 |

**0% → 0% → 0% → 100%.** No gradient. No partial credit.

## Why Partial Hints Fail

The critical finding: **telling the agent exactly what's wrong (arm 3) still produces 0%.** The bottleneck isn't recognition — it's the recognition-to-execution bridge.

Three mechanisms:

1. **Cascading dependencies create execution cliffs.** Bug 2 is only discoverable after fixing Bug 1 correctly. Knowing "Bug 1 exists" without knowing the exact fix means the agent fails at the first uncovered step, producing the same outcome as knowing nothing.

2. **Partial hints trigger premature solver mode (KE-192).** The agent receives "pipeline order is wrong" and narrows focus to fixing that — but without the exact fix, it produces confident-but-wrong patches. Partial hints may be actively harmful by foreclosing exploration.

3. **The information gap is in execution, not recognition.** We assumed agents needed help *seeing* problems. They actually need help *executing multi-step cascading fixes* where each step depends on the previous one.

## Design Implications

- **F1 cannot be cheapened.** There is no "lite" version that still works. Either provide the full analysis or provide nothing — half-measures are wasted compute.
- **For cascading-bug scenarios, the minimum effective dose is the complete solution.** This is fundamentally different from single-bug scenarios (where recognition alone might suffice — untested, see H-166 P2).
- **Intervention design is binary.** Invest in high-quality complete analyses rather than trying to scale partial hints across more scenarios.

## Boundary Conditions

- Demonstrated on cascading-fix-trap-v2 (multi-bug, sequential dependencies)
- May not hold for single-bug scenarios where recognition IS the full bottleneck (H-166 P2)
- Small N on arms 2-3 (95% CI includes up to ~30%), but point estimates are 0% and consistent with the mechanism

---

*Filed by Bob (Architect) — 2026-04-16*
