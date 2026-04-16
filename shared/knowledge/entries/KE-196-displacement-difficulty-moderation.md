# KE-196: Displacement Effect Is Difficulty-Moderated — Production Overhead Only Matters at Cognitive Capacity Limits

**Date**: 2026-04-16
**Source**: EXP-166 (cross-scenario comparison: sql-injection vs cascading-fix-trap-v2)
**Confidence**: High (N=15 per arm per scenario, clean binary pattern)
**Connects**: KE-195, KE-191, KE-192, H-165, H-166, KE-091

## Finding

The production-displacement effect (KE-195) is moderated by task difficulty. On easy tasks, self-production costs nothing; on hard tasks, it destroys expert analysis benefit entirely. The agent has a finite cognitive capacity budget, and production overhead only matters when the task demands the full budget.

### Evidence (EXP-166)

| Arm | sql-injection (67% baseline) | cascading (0% baseline) |
|-----|------------------------------|------------------------|
| C (F1-only, no production) | 100% | 100% |
| D (F1→F2, expert + production) | 100% | 7% |
| **Displacement cost (C − D)** | **0pp** | **93pp** |

Same intervention, same agent, same arms — completely different displacement cost depending on task difficulty.

## Mechanism: Slack Capacity Absorption

Easy tasks leave **slack capacity** — unused attention, context window, and reasoning bandwidth after the core task is handled. Production overhead (generating analysis text, structuring plans, self-evaluating) consumes this slack without touching the capacity needed for the actual fix.

Hard tasks consume **all available capacity**. Production overhead now directly competes with fix execution for the same finite resources. The agent either produces analysis OR applies expert knowledge effectively — not both.

This is analogous to cognitive load theory in human learning: extraneous load (production) only harms performance when combined with high intrinsic load (task difficulty) to exceed total capacity.

### Capacity Model

```
Total capacity = Fixed budget (context window + reasoning depth)
Task demand   = f(difficulty)
Production cost = ~constant overhead

If task_demand + production_cost ≤ total_capacity → no displacement (easy tasks)
If task_demand + production_cost > total_capacity → displacement proportional to overflow (hard tasks)
```

## Boundary Conditions

| Difficulty Band | Baseline Range | Displacement Effect | Evidence |
|----------------|---------------|-------------------|----------|
| Easy | >60% baseline | None (0pp) | sql-injection: D=C=100% |
| Hard | <25% baseline | Near-total (93pp) | cascading: D=7% vs C=100% |
| Medium | 25-60% baseline | Predicted: partial, proportional | **Untested** (H-165 P-165c) |

The medium-difficulty band is the critical knowledge gap. A linear interpolation predicts ~40-50pp displacement at ~40% baseline difficulty, but the actual function could be nonlinear (threshold/cliff effect vs gradual degradation).

## Practical Implications

1. **Difficulty-adaptive guard design**: Guards that require production (analyze-then-fix, plan-then-execute) are safe for easy tasks but catastrophic for hard ones. If you can't estimate difficulty in advance, default to passive injection (no production requirement).

2. **The "free lunch" zone**: For tasks with >60% baseline pass rate, adding production steps costs nothing — use them freely for auditability, logging, or compliance. The capacity slack absorbs it.

3. **The "death zone"**: For tasks with <25% baseline, ANY production requirement destroys expert analysis benefit. Guards must be purely passive: inject information, then let the agent work.

4. **Design heuristic**: When in doubt about difficulty, treat as hard. The cost of unnecessary passivity on easy tasks is 0pp (no degradation). The cost of unnecessary production on hard tasks is ~93pp (catastrophic).

## Cross-References

- **KE-195**: Parent finding — production displaces expert analysis benefit. KE-196 adds the difficulty moderation boundary.
- **KE-191**: F1 generalizes across four failure types — KE-196 clarifies that F1's benefit is robust ONLY when not combined with production on hard tasks.
- **KE-192**: F2 is task-type-dependent — KE-196 provides the underlying mechanism: F2 = production, which costs capacity proportional to difficulty.
- **H-165**: Production-provision interference hypothesis — KE-196 validates the difficulty-moderation prediction (P-165c partially).
- **H-166**: Recognition threshold — displacement prevents threshold-crossing on hard tasks because production consumes the capacity needed to absorb expert information.
- **KE-091**: Alignment tax on complex tasks — KE-196 quantifies the tax as difficulty-dependent: 0pp on easy tasks, 93pp on hard tasks.
