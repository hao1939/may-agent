# DD#549: Power Laws of Collective Cognition — Intellectual Elites in LLM Multi-Agent Systems

**Source**: arXiv:2604.02674 — Kavana Venkatesh, Jiaming Cui (Virginia Tech)
**Date**: 2026-04-06
**Rating**: ★★★★★ LANDMARK

## Core Contribution

First empirical quantitative laws governing LLM multi-agent coordination dynamics. Analyzing 1.5M coordination events across 4 benchmarks (GAIA, SWE-bench, REALM-Bench, MultiAgentBench), 7 topologies, agent counts 8–512, discovers three coupled structural laws:

1. **Heavy-tailed cascades**: Coordination event sizes follow truncated power-law (α̂ ∈ (2,3)), validated via MLE + Vuong tests
2. **Intellectual elite formation**: Small agent subset concentrates disproportionate cognitive effort via preferential attachment
3. **Extreme event scaling**: Frequency of extreme coordination events increases with system size

All three coupled through a single mechanism: the **integration bottleneck**.

## The Integration Bottleneck

> As system size increases, cascade *generation* (delegation + contradiction) continues to scale, while *integration* (merge operations) does NOT scale proportionally.

Multi-agent systems get better at expanding reasoning but not consolidating it. This is a **coordination architecture** problem, not a model capability problem.

### Five Atomic Coordination Primitives

| Event Type | What It Captures |
|---|---|
| Delegation Cascade | Recursive task decomposition size |
| Revision Wave | Iterative refinement chain length |
| Contradiction Burst | Parallel critique of single claim |
| Merge Fan-in | Information integration bottleneck |
| Total Cognitive Effort | Aggregate downstream cascade size |

## Deficit-Triggered Integration (DTI)

When expansion-to-integration ratio exceeds threshold, DTI triggers forced integration. Preserves heavy-tailed regime while improving task success rates. The fix doesn't fight natural dynamics — it corrects the structural deficit.

## Key Implications

- α̂ ∈ (2,3) appears universal across architectures (like citation networks α ≈ 3)
- Equal-weight voting fights natural dynamics; role assignment (DD-546) essential
- Elite agents expand reasoning but nobody integrates it — need "integration elites"
- Bridges to complex systems theory: preferential attachment, self-organized criticality, information cascades

## Scale: 1.5M interactions, 4 benchmarks × 7 topologies × 7 scales × 5 seeds

## Predictions

- P316: α̂ ∈ (2,3) confirmed as universal constant across LLM MAS architectures
- P317: DTI-style integration forcing becomes standard within 6 months
- P318: Integration bottleneck identified as primary cause of >80% MAS scaling failures
- P319: "Integration elite" agents deliberately designed

**Seeds KE-086.**
