# CR#296: The Integration Bottleneck — Why Multi-Agent Systems Break At Scale

**Date**: 2026-04-06
**Type**: Cross-reference synthesis
**Rating**: ★★★★★
**Connects**: DD-549, DD-544, DD-546, DD-547, DD-548, CR-295

## The Convergence

The fundamental bottleneck in scaling multi-agent systems is not reasoning capacity but **integration capacity**.

DD-549 proves empirically: coordination expansion scales linearly with agents while consolidation doesn't, producing heavy-tailed cascades that are big but weakly integrated. Same insight was hiding in every paper:

| Paper | Expansion | Integration | What Breaks? |
|---|---|---|---|
| DD-549 (Power Laws) | Delegation + Contradiction | Merge operations | Merge doesn't scale |
| DD-544 (Textbook) | 30K agents generating proofs | Type checker verification | Succeeds BECAUSE Lean forces integration |
| DD-546 (Role Clarity) | Overlapping roles | Role clarity matrix | Role overstepping = uncontrolled expansion |
| DD-547 (Dual Memory) | Neural progress memory | Symbolic Python verification | Works because symbolic forces verification |
| DD-548 (InfoSeeker) | Workers search parallel | Manager aggregation + isolation | Natural DTI: forced merge at Manager layer |

## The Pattern: Successful Systems Force Integration

Every successful MAS contains explicit integration-forcing:
1. **Lean type checker** (DD-544) — mathematical proof forcing logical integration
2. **Role clarity matrix** (DD-546) — quantitative boundaries preventing expansion
3. **Python symbolic verifier** (DD-547) — hard validation rejecting impossibilities
4. **Manager aggregation** (DD-548) — hierarchical merge gates
5. **DTI** (DD-549) — deficit monitoring triggering forced integration

## Reinterpretation of CR-295

- **Experience axis = Expansion** (delegation, contradiction, revision)
- **Verification axis = Integration** (merge, synthesis)

Expansion scales naturally with agent count; integration doesn't. Verification axis is the binding constraint.

## The Unified Theory

```
Performance(N) ∝ Expansion(N) × Integration(N) / Coordination_Cost(N)
  Expansion(N)        ∝ N^β    (β > 1, superlinear)
  Integration(N)      ∝ N^γ    (γ < 1, sublinear)
  Coordination_Cost(N) ∝ N^δ   (δ ≈ 1.5-2, superlinear)
```

Optimal agent count N* exists. Only improves by improving Integration capacity.

## Design Principles

1. **Mandatory Integration Gates**: Force merge/verification at predetermined cascade sizes
2. **Monitor Expansion-Integration Ratio**: Real-time DTI-style circuit breakers
3. **Design Integration Elites**: Dedicated "integrator" agents for merge operations

## Predictions

- P320: Integration-forcing becomes central MAS design consideration
- P321: Optimal N* ≈ 20-64 for current architectures, 1000+ with symbolic verification
- P322: "Integration debt" recognized as MAS equivalent of technical debt

**Seeds KE-086.**
