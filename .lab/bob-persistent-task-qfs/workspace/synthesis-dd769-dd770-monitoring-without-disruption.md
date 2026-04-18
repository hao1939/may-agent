# Synthesis: DD-769 × DD-770 — Monitoring Agent Cognition Without Disrupting It

**Date**: 2026-04-16 | **Sources**: DD-769, DD-770

## Thread Summaries

**DD-769 (Solver-Sampler Mismatch)**: Stronger reasoning doesn't always help. When agents need to *sample* plausible behavior rather than *solve* optimally, native reasoning collapses behavioral diversity. GPT-5.2 produced 45/45 identical authority outcomes with full reasoning; bounded reflection restored compromise dynamics. Core lesson: constraining cognitive capability can improve system-level outcomes.

**DD-770 (Cognitive Companion)**: Agents degrade (loop, drift) ~30% of the time on hard tasks. Two monitoring approaches work: LLM companion (52-62% loop reduction, 11% overhead) and hidden-state probes (AUROC 0.840, zero overhead). Critical caveat: monitoring helps loop-prone/open-ended tasks but is neutral-to-harmful on structured tasks.

## Unified Theory: The Observation Tax

Both papers converge on the same principle: **cognitive monitoring has a mode-dependent cost**.

| Monitoring approach | When it helps | When it hurts |
|---|---|---|
| Reasoning enhancement (DD-769) | Solver tasks (optimization) | Sampler tasks (exploration, negotiation) |
| LLM companion (DD-770) | Loop-prone, open-ended tasks | Structured tasks |
| Hidden-state probes (DD-770) | All degradation-prone tasks | Below scale threshold (≤1.5B) |

**The unified insight**: You can monitor agent cognition without disrupting it, but only if monitoring is **mode-selective** — activated based on task type, not applied uniformly.

## Three Principles for Non-Disruptive Monitoring

1. **Match monitor to mode**: Solver tasks tolerate (benefit from) reasoning-heavy oversight. Sampler/creative tasks need passive observation (probes, not companions). This directly validates KE-091 (verification guards harm creative tasks) and KE-123 (don't stack interventions).

2. **Prefer sub-symbolic monitoring**: DD-770's probe approach (hidden-state classifiers) detects degradation *before* it manifests in text, with zero inference overhead. This is strictly better than text-level monitoring when available — it doesn't alter the agent's cognitive process at all.

3. **Bounded reflection > full reasoning for oversight**: DD-769 shows bounded reflection preserves behavioral diversity while still catching errors. Applied to monitoring: lightweight periodic check-ins outperform continuous deep verification.

## Connection to Our System

- **FM-3.3 (verification collapse, 20.3% rate)**: DD-770's probe approach could detect this from hidden states before it manifests. Our current approach (guards) is text-level — higher disruption.
- **KE-123 (over-intervention iatrogenesis)**: Both papers independently confirm that more monitoring ≠ better outcomes. DD-769 shows capability itself can be harmful; DD-770 shows monitoring is harmful on wrong task types.
- **Guard architecture**: Our content-first guard design should incorporate task-type classification to decide monitoring intensity. Structured tasks (commits, file writes) → full verification. Creative tasks (synthesis, hypothesis) → minimal or probe-only monitoring.

## Impact/Novelty Ranking

1. **🔴 High**: Sub-symbolic (probe-based) monitoring is feasible and zero-overhead — this could replace text-level guards for degradation detection
2. **🔴 High**: Task-type selectivity is mandatory, not optional — uniform monitoring demonstrably hurts performance  
3. **🟡 Medium**: Bounded reflection as a design pattern for oversight (constrain reasoning to improve system outcomes)
4. **🟡 Medium**: The solver-sampler distinction applies to our agents — debate/exploration tasks need different oversight than verification tasks

## Next Steps

1. **H-next**: Hypothesize that FM-3.3 rate would decrease if guards activated only on structured tasks (not synthesis/creative)
2. **Experiment**: Compare current uniform guard activation vs. task-type-selective activation on gym scenarios
3. **Design update**: Incorporate task-type classifier into guard architecture (agents/shared/may-agent-docs/design/)
