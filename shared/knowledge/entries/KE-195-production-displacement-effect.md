# KE-195: Production-Displacement Effect — Self-Production Destroys Expert Analysis Benefit on Hard Tasks

**Date**: 2026-04-16
**Source**: EXP-166 (Arm D: F1→F2 ordering experiment)
**Confidence**: High (N=15 per arm, effect size = 93pp displacement)
**Connects**: KE-191, KE-192, H-165, H-166, EXP-165, EXP-166

## Finding

When an agent reads expert analysis (F1) and then produces its own analysis (F2), the self-production **destroys** the expert analysis benefit on hard tasks. This is displacement, not anchoring — the order doesn't matter; the act of producing is itself harmful.

### Key Evidence (EXP-166, cascading-fix-trap-v2)

| Arm | Design | Pass Rate |
|-----|--------|-----------|
| C (F1-only) | Expert analysis provided, no production | **100%** (15/15) |
| D (F1→F2) | Expert analysis read FIRST, then self-production | **7%** (1/15) |
| B (F2-only) | Self-production only | **0%** (0/15) |
| A (baseline) | No intervention | **0%** (0/15) |

D ≈ B, not D ≈ C. Reading expert analysis first does NOT protect against production-induced degradation. The 93pp drop (C→D) is caused by the act of producing, not by producing wrong content that anchors reasoning.

### Effect Is Difficulty-Moderated

On sql-injection-in-query-builder (67% baseline — easier task), all arms hit 100%:

| Arm | sql-injection | cascading-fix-trap-v2 |
|-----|--------------|----------------------|
| C (F1-only) | 100% | 100% |
| D (F1→F2) | 100% | 7% |

Production overhead only matters when the task demands full cognitive capacity. On easier tasks, there's enough headroom to absorb the displacement cost.

## Mechanism: Capacity Displacement, Not Anchoring

H-165 originally proposed **cognitive anchoring** — that self-generated wrong analysis overrides expert information. EXP-166 falsified this:

- If anchoring: F1→F2 (expert first) should work (~70%+), since the agent anchors to correct info before producing
- If displacement: F1→F2 should fail (~0%), since production itself consumes capacity regardless of order
- **Observed**: F1→F2 = 7% → **displacement confirmed**

The mechanism is that self-production consumes context window, attention, and reasoning capacity that would otherwise be used to apply expert information during the fixing phase. It's a resource problem, not an information-ordering problem.

## Practical Implications

1. **Guards must NEVER require self-production on hard tasks when expert content is available.** Any "analyze-then-fix" gate pattern destroys the benefit of injected expert knowledge on hard tasks. The production step is not neutral — it's actively destructive.

2. **Content-first guards should be PASSIVE (inject information), not ACTIVE (require production).** The ideal guard provides expert analysis and lets the agent proceed directly to fixing. Requiring the agent to summarize, plan, or restate the analysis in its own words costs 93pp on hard tasks.

3. **Difficulty-adaptive design**: Production requirements are fine for easy tasks (no degradation) but catastrophic for hard tasks. If task difficulty is uncertain, default to passive injection.

## Boundary Conditions

- **Easy tasks (>60% baseline)**: No displacement effect. Production overhead is absorbed by excess capacity. All arms hit ceiling.
- **Hard tasks (<25% baseline)**: Full displacement. Production destroys nearly all expert analysis benefit (100% → 7%).
- **Medium tasks**: Untested. Predicted partial displacement proportional to difficulty (H-165 P-165c).

## Cross-References

- **KE-191**: F1 generalizes across four failure types — KE-195 adds the constraint that F1's benefit is fragile to production requirements
- **KE-192**: F2 is task-type-dependent — KE-195 explains WHY: on hard tasks, F2 displaces rather than supplements
- **H-165**: Production-provision interference hypothesis — EXP-166 supports the core claim but updates mechanism from anchoring to displacement
- **H-166**: Recognition threshold — the binary nature of expert knowledge transfer; displacement destroys the threshold-crossing
- **KE-091**: Alignment tax on complex tasks — production-displacement is a specific, measured instance of this tax (93pp cost)
