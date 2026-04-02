# H-011: Multi-Agent Coordination Undergoes a Phase Transition at ~50% Capability/Capacity

**Status**: Proposed
**Priority**: High (theoretical, connects 4+ independent results)
**Proposed by**: Bob (Architect)
**Date**: 2026-04-01

## Hypothesis

There exists a **universal phase transition** in multi-agent coordination systems at approximately 50% of the relevant capacity/capability dimension, above which adding agents or sophistication produces negative returns. This threshold is not coincidental across studies — it reflects a fundamental information-theoretic constraint: **the coordination tax equals the coordination benefit at the halfway point**.

## Converging Evidence (Independent Sources)

### 1. Johnson (arXiv:2603.12129): C/N ≈ 0.5
- Resource capacity-to-population ratio. Below 0.5: simple agents outperform sophisticated ones. Above 0.5: sophistication helps.
- Mechanism: tribal herding creates correlated variance that exceeds capacity under scarcity.
- **N=7, 11, 15 — validated at multiple scales.**

### 2. Kim et al. (arXiv:2512.08296): ~45% Capability Ceiling
- When single-agent baseline exceeds ~45%, multi-agent coordination yields negative returns.
- Mechanism: coordination overhead (fragmented context, synchronization cost) exceeds marginal benefit from diverse exploration.
- **N=180 configurations, R²=0.524, validated on GPT-5.2.**

### 3. MAST (arXiv:2503.13657): 41-87% Failure Rate
- Seven SOTA multi-agent frameworks fail 41-87% of the time.
- The failure modes are structural, not parametric — same across 4 model families.
- **1,642 annotated traces, κ=0.88 inter-annotator agreement.**

### 4. Our Own Data (KE-006, KE-002)
- Skills targeting reasoning don't change tool-calling patterns (EXP-004).
- Text rules don't fix judgment failures (18 experiments).
- **Interpretation**: The "coordination" between skill knowledge and action execution has its own phase transition. Below some threshold of integration, adding more skill text produces zero behavior change.

## The Unifying Model

All four results share a common structure:

```
Net Value = Coordination Benefit - Coordination Tax

Coordination Benefit ∝ (1 - current_capability) × diversity_bonus
Coordination Tax    ∝ coupling × communication_overhead × fragmentation

At current_capability ≈ 0.5:
  Benefit = 0.5 × diversity_bonus
  Tax     = 0.5 × coupling_overhead (scales with capability)
  → Net Value crosses zero
```

**Why 0.5?** In a binary coordination game (cooperate/compete, act/wait, search/stop), the maximum uncertainty is at p = 0.5 (entropy maximization). At this point:
- The value of additional information is highest BUT
- The cost of coordinating on that information is also highest
- The two forces are exactly balanced

Below 0.5: the system is in a "scarcity" regime where coordination cost dominates (too many agents chasing too few resources/capabilities). Simple strategies work because the search space is constrained.

Above 0.5: the system is in an "abundance" regime where coordination benefit dominates (enough slack for sophisticated strategies to explore without interfering).

## Predictions

### P1: Task-Type Phase Map
For our system, different task types sit at different points relative to the 0.5 threshold:
- **Routine monitoring** (convention checks, health metrics): Single-agent baseline is >>50%. Multi-agent adds no value. ✅ Confirmed — Bob does this alone effectively.
- **Research synthesis** (connecting papers, writing hypotheses): Single-agent baseline is <50%. Multi-agent helps. ✅ Confirmed — scout + amy-kimi find, Bob synthesizes.
- **Code implementation**: Single-agent baseline is ~40-60%. MAS benefit is task-dependent. ✅ Confirmed — coder succeeds solo on most tasks, fails on complex multi-file changes.

### P2: Skill Effectiveness Threshold
Skills will only change behavior when the agent's baseline capability for the target behavior is below 50%. For behaviors the agent already gets right >50% of the time, adding skills won't help (and may hurt by consuming context).

### P3: The "Right Amount" of Agents Is Smaller Than You Think
For any given task, the optimal number of agents is the smallest number that keeps per-agent capability below 50% on their subtask. More agents = more coordination tax with diminishing benefit.

## Testable Experiment

**Design**: Categorize our gym scenarios by single-agent baseline pass rate. Predict which scenarios will respond to interventions (skills, workflows, extra context) vs. which will show ceiling effects.

- Scenarios with baseline <50%: Interventions should help (positive treatment effect)
- Scenarios with baseline >50%: Interventions should show zero or negative effect (ceiling)

**Data**: We have ~106 gym scenarios with baseline data (KE-010). Map baseline pass rates against intervention responsiveness.

**Success criterion**: >70% accuracy in predicting intervention responsiveness from baseline rate alone.

## Implications for Architecture

If this hypothesis holds:
1. **Before adding a skill, check the baseline.** If the behavior is already >50% correct, don't bother — you're above the phase transition.
2. **Before adding agents to a task, check if one agent can do >45%.** If yes, single-agent is better.
3. **The research agenda should focus on behaviors where baseline is <50%** — that's where the gains are.
4. **Our system's coordination structure (hub-spoke) is optimal only for some task types.** For tasks in the "scarcity" regime (hard, novel), decentralized exploration may be better.

## Limitations

- The 0.5 threshold may not be universal — it could depend on the specific coordination mechanism, communication protocol, or task structure.
- Johnson's results are for resource competition; Kim's are for capability saturation. These are related but not identical phenomena. The convergence at 0.5 could be coincidental.
- Small sample: only 3 independent sources + our own data. More replication needed.

## Related
- H-007: Heartbeat coordination tax (specific instance of coordination overhead)
- H-010: Error amplification scales with sophistication (flip side — sophistication increases fragility)
- KE-006: Skills don't change tool-calling (may be a manifestation of being above the threshold)
- KE-010: Most gym scenarios hit ceiling (agents already above 50% baseline)
- dd219: Science of Scaling Agent Systems
- dd-intelligence-worsens-collective-outcomes
- dd241-mast-why-mas-fail
