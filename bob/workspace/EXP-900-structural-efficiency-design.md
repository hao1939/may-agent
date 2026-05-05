# EXP-900: Structural Efficiency — Tool-Call Budget as Hard Constraint

**Date**: 2029-09-04
**Status**: HYPOTHESIS
**Owner**: bob

## Motivation

Multiple experiments (EXP-850, EXP-580, EXP-800) confirm a pattern: **text-based nudges do not change agent behavior**. Whether it's "be efficient," "verify after write," or SOUL.md placement — agents ignore prose instructions.

However, **structural constraints** (tool changes, format enforcement, gating mechanisms) DO work (EXP-350: +46pp with a verify-notification-targets skill that changes the workflow structure).

## Hypothesis

**If we limit agents to N tool calls per task (hard budget enforced by the runner), agents will achieve the same correctness with fewer wasted calls on complex tasks (≥5 files).**

Key insight: The constraint must be *structural* (enforced by infrastructure), not *textual* (requested in prompt).

## Design

### Arms
- **A (baseline)**: No budget. Agent runs normally on a complex scenario (10+ file refactor).
- **B (hard budget)**: Runner caps tool calls at 80% of baseline mean. Agent receives a countdown ("X calls remaining") in each response.

### Scenario
Need a scenario complex enough to show waste. `multi-file-refactor` is too simple (agents already optimal at ~20s). 

**Proposed**: A new scenario with 8-10 files, requiring reading → planning → executing. Agents likely re-read files unnecessarily.

### Metrics
- Primary: Tool-call count (direct measurement, not duration proxy)
- Guard: Pass rate must stay ≥80% (no quality regression)
- Secondary: Duration

### Sample Size
- 10 trials per arm (more variance expected on complex task)

## Risks
- Hard budget might cause failures on edge cases → mitigate with 80% threshold (not minimum)
- Need runner infrastructure changes → check if gym supports this

## Key Insight (Meta-Pattern)

| Intervention Type | Examples | Success Rate |
|---|---|---|
| Text nudge in prompt | EXP-850, EXP-580, EXP-800 | 0/3 (0%) |
| Structural/workflow change | EXP-350, EXP-745 | 2/2 (100%) |

**Conclusion**: Stop designing text-based interventions. Only pursue structural ones.

## Next Steps
1. Validate that gym runner can enforce tool-call budgets
2. Design a complex scenario (or find existing one with >5 files)
3. Run Phase 0 baseline (10 trials)

## Dependencies
- Gym runner modification for tool-call counting + budget enforcement
