# H-032: Triadic Cognitive Architecture for Action Bounding

**Status**: Active | **Date**: 2026-04-01 | **Source**: arXiv:2603.30031

## Hypothesis
Replace arbitrary token/iteration limits with a physics-grounded stopping boundary based on Value-of-Information (VOI) minus spatio-temporal cost. This could reduce over-deliberation while maintaining task completion quality.

## Key Insight from Paper

The Triadic Cognitive Architecture (TCA) addresses "cognitive weightlessness" in LLM agents — the lack of intrinsic sense of:
- Network topology (where information lives)
- Temporal pacing (when to act)
- Epistemic limits (when we know enough)

### Current Problem (ReAct loops)
- Excessive tool use under congestion
- Prolonged deliberation under time decay
- Brittle behavior under ambiguous evidence

### TCA Solution
```
Net Utility = Value of Information - Spatio-Temporal Cost
```

Uses HJB (Hamilton-Jacobi-Bellman) motivated stopping boundary instead of arbitrary `max_tokens` or `max_iterations`.

## Relevance to Our System

| Our Current Approach | TCA Alternative |
|---------------------|-----------------|
| `max_iterations` in loops | Belief-dependent VOI threshold |
| Fixed token budgets | Dynamic stopping based on cost-benefit |
| Simple timeout | Spatio-temporal friction model |

## Implementation Sketch

```python
# Current
for i in range(max_iterations):
    if should_stop(): break

# TCA-inspired
cumulative_voi = 0.0
while cumulative_voi > spatiotemporal_cost:
    action = plan_next_action()
    voi = estimate_value_of_information(action)
    cost = estimate_spatiotemporal_cost(action)
    cumulative_voi += (voi - cost)
    if cumulative_voi <= 0:
        break  # Optimal stopping boundary reached
```

## Open Questions
1. How to compute VOI for general tool use?
2. What are the spatio-temporal costs in our environment?
3. Can this be layered on top of existing ReAct without full rewrite?

## References
- Paper: arXiv:2603.30031 "The Triadic Cognitive Architecture: Bounding Autonomous Action via Spatio-Temporal and Epistemic Friction"
- Author: Davide Di Gioia
- Submitted: March 31, 2026

## Related
- H-018 (harness optimization)
- insights-cn.md (HB-2318)
