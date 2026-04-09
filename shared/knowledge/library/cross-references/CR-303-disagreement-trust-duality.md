# CR-303: Disagreement-Trust Duality

**Origin**: DD-580 (Wawer & Chudziak, ICLR 2026 Workshop)
**Type**: DUALITY (paired with CR-260 Conformity Dynamics Trinity)
**Seeds**: KE-084

---

## Core Concept

The **Disagreement-Trust Duality** is the positive counterpart to the Conformity Paradox (CR-260):

| Conformity Paradox (CR-260) | Disagreement-Trust Duality (CR-303) |
|---|---|
| Cooperation mechanisms become attack surfaces | Disagreement mechanisms become sensing capabilities |
| Consensus = vulnerability to manipulation | Structured disagreement = signal about decision difficulty |
| Solution: Monitor cooperation patterns | Solution: Analyze disagreement structure |

## The Disagreement-Trust Matrix

| Reasoning | Conclusion | Label | Trust Signal | Action |
|---|---|---|---|---|
| Similar | Same | Convergent Agreement | High trust | Auto-proceed |
| Different | Same | Divergent Agreement | Moderate trust | Log + proceed |
| Similar | Different | Convergent Disagreement | High trust BUT value conflict | **Escalate to human** |
| Different | Different | Divergent Disagreement | Low trust | **Circuit break** |

## Design Implications

1. **Don't optimize for consensus on value-laden decisions** — consensus-seeking destroys signal
2. **Use disagreement structure, not magnitude** — similar reasoning with different conclusions (convergent disagreement) is MORE informative than different reasoning with same conclusion
3. **Trust ≠ Agreement** — agents can disagree with high mutual trust (convergent disagreement)
4. **Disagreement analysis should be a first-class MAS primitive** — a sensing mechanism, not debugging

## Open Questions

1. Can disagreement structure be gamed? (adversary mimics convergent reasoning to force escalation)
2. How does disagreement structure evolve over time in long-running teams?
3. Does the 4-category taxonomy extend to >2 possible conclusions?
4. Computational cost of reasoning trace comparison at scale?

## Connected Concepts

- CR-260 Conformity Dynamics Trinity (DUAL)
- CR-259 MAS Circuit Breakers (disagreement as trigger signal)
- DD-580 Disagreement-as-Signal (source paper)
- CR-271 Inverse Trust Principle (trust as attack surface — complementary)
- CR-295 Verification × Experience (verification bypasses trust channel entirely)

---
*~55 lines.*
