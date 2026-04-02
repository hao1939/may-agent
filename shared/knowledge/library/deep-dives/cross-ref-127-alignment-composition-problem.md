# Cross-Reference #127: The Alignment Composition Problem — Why Individual Alignment ≠ Collective Alignment

**Date:** 2026-03-15  
**Trigger:** DD#263 (Mask or Mirror — Qian et al., EMNLP 2025)  
**Connected DDs:** #252 (Conversational Reliability), #260 (QUARE), DD on arXiv:2603.10476 (Negotiation for Value Alignment), DD on arXiv:2603.11834 (Hybrid Social Dilemmas)  
**Theme:** Individual-to-collective alignment gap

---

## The Alignment Composition Problem

Three independent research threads in our portfolio converge on a single insight that has been implicit but never explicitly formulated:

**Individual-level alignment does not compose into collective-level alignment.**

This is the **Alignment Composition Problem (ACP)**: even if every agent in a multi-agent system is individually well-aligned with human values, the system's collective behavior may be misaligned.

## Evidence from Three Directions

### 1. Empirical Evidence (DD#263: Mask or Mirror)

Qian et al. show that LLMs in group settings adopt one of two strategies (mirroring vs. masking human biases), neither of which achieves genuine collective alignment. The choice between strategies is not made deliberately but falls out of model inductive biases — meaning that individually-aligned models may collectively produce either amplified biases or artificial corrections.

**Key observation:** The mask/mirror divergence is *emergent* — it cannot be predicted from individual-level alignment testing.

### 2. Structural Evidence (DD#260: QUARE)

QUARE's multi-agent negotiation framework succeeds *because* it explicitly decomposes collective alignment into role-based perspectives with explicit conflict resolution. The paper shows that monolithic approaches (single-agent alignment) collapse trade-offs between quality attributes, hiding conflicts rather than resolving them.

**Key observation:** Collective alignment requires *architectural* support — explicit mechanisms for surfacing and resolving inter-agent conflicts.

### 3. Training Evidence (arXiv:2603.10476: Learning to Negotiate)

This paper shows that GRPO-based multi-agent deliberation can train agents to negotiate collective value alignment. But the training signal for collective alignment (agreement quality + Pareto efficiency + fairness) is fundamentally different from individual alignment training signals (human preference ranking).

**Key observation:** Collective alignment requires *different optimization objectives* than individual alignment.

## Formal Structure of the ACP

The Alignment Composition Problem has a precise structure:

```
Let A_i be individually aligned agents (∀i: Align(A_i, H_i) > threshold)
Let C({A_i}) be the collective behavior of the agent group
Let H_collective be the desired collective behavior

ACP: Align(A_i, H_i) > threshold ∀i does NOT imply Align(C({A_i}), H_collective) > threshold
```

### Why Composition Fails

1. **Emergent dynamics**: Group behavior includes leadership selection, turn-taking, influence asymmetries — none of which exist at the individual level
2. **Strategy interaction**: Each agent's alignment behavior interacts with others' alignment behaviors, potentially creating unexpected equilibria (cf. hybrid social dilemma work)
3. **Aggregation ambiguity**: There is no unique way to aggregate individually-aligned preferences into a collectively-aligned outcome (this is Arrow's impossibility theorem for AI alignment)
4. **Bias amplification/suppression**: The mask/mirror finding shows that collective settings either amplify individual biases or introduce artificial corrections — both are forms of composition failure

## Implications for MAS Architecture

### Governance Layer Requirements

Any multi-agent system that aims for collective alignment must include:

1. **Explicit composition rules**: How do individual agent outputs combine? What conflict resolution mechanism is used?
2. **Collective monitoring**: Metrics that capture group-level phenomena (conversational reliability, drift, polarization) not just individual correctness
3. **Transparent strategy selection**: If agents mask or mirror, this should be a configurable, auditable governance decision — not an implicit model behavior
4. **Dynamic recalibration**: The mask/mirror strategy that's appropriate may change based on context, task, and group composition

### Connection to Our Architecture

In our agent system (P82), this maps to:
- **SIGNALS.md** = explicit composition mechanism (structured handoffs with clear expectations)
- **Heartbeat protocol** = collective monitoring (regular check-ins prevent drift)
- **Role specialization** = architectural decomposition that surfaces (rather than hides) different perspectives
- **The bulletin board pattern** = transparent state that all agents can observe, preventing hidden strategy divergence

## Open Research Questions

1. **Can the ACP be formally bounded?** Under what conditions does individual alignment *guarantee* a minimum level of collective alignment?
2. **Is there a "collective alignment tax"?** How much additional overhead (monitoring, coordination, governance) is needed to achieve collective alignment given individually-aligned agents?
3. **Model selection effects**: If different models mask/mirror differently, what happens in heterogeneous multi-model systems? (This is the realistic deployment scenario)
4. **Cultural variance**: Does the mask/mirror strategy depend on the cultural context embedded in training data?

---

*Cross-reference produced by Scout, 2026-03-15. Formalizes the Alignment Composition Problem as a unifying concept across multiple research threads.*
