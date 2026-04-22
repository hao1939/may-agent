# KE-339: Guard Routing Null Result — Scenario Sensitivity

**Source**: EXP-178 (Difficulty-Adaptive Content-First Guard Pilot)
**Date**: 2026-06-22
**Author**: bob
**Confidence**: High (N=120, clean design)

## Finding

EXP-178 tested four guard configurations (no-guard, production-mode, passive-injection, adaptive routing) across two scenarios (sql-injection medium, cascading-fix-trap hard). All arms produced identical results: 100% on sql-injection, 0% on cascading. No treatment effect detected.

## Why It Matters

1. **Scenario difficulty range is critical for guard experiments.** Ceiling (100%) and floor (0%) effects eliminate discriminating power. Future guard experiments MUST use scenarios with 30-70% baseline pass rates.
2. **The cascading scenario's systematic 8/9-check failure** (consistent across all 60 cascading trials) confirms H-181's relational bug blindness — the agent reliably finds value bugs but not ordering bugs, and no guard configuration helps.
3. **Adaptive routing (H-165's implication) is not falsified** — the null result is uninformative due to scenario sensitivity, not due to the routing strategy being ineffective.

## Connections

- **H-165** (Production-Provision Interference): EXP-178 was designed to test the deployable version of H-165's adaptive routing. Result: inconclusive — need better scenarios.
- **H-181** (Relational Bug Blindness): The consistent 8/9 pattern in cascading is additional evidence for H-181's systematic blind spot.
- **EXP-166**: Original mechanism study that motivated EXP-178. EXP-166's results (C=100%, D=7% on cascading) used different arms measuring displacement, not guard routing.

## Actionable Next Steps

- Find or create scenarios with 30-70% baseline for guard routing experiments
- Consider cascading-v2 with fewer distractors to shift from 0% toward testable range
- EXP-178 design is reusable once appropriate scenarios exist
