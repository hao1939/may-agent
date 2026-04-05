# Competition and Cooperation of LLM Agents in Games

**Source:** arXiv:2604.00487 (April 1, 2026)  
**Authors:** Jiayi Yao, Cong Chen, Baosen Zhang (University of Washington)

## Core Insight

LLM agents **don't converge to Nash equilibria** — instead, they exhibit emergent cooperation when given multi-round prompts and non-zero-sum framing. Fairness reasoning is central to their strategic behavior.

## Experimental Setup

Two standard game theory scenarios:
1. **Network resource allocation game** — competitive resource distribution
2. **Cournot competition game** — quantity-based market competition

## Key Findings

### Cooperation Emergence
- LLM agents tend to **cooperate** rather than compete
- Behavior emerges from **fairness reasoning** in chain-of-thought
- Multi-round context enables reciprocal behavior

### Non-Convergence to Nash
- Traditional game theory predicts Nash equilibrium
- LLM agents systematically deviate toward cooperative outcomes
- Non-zero-sum framing amplifies cooperation

### Fairness as Mechanism
Chain-of-thought analysis reveals:
- Agents explicitly reason about "fair" distributions
- Reciprocal altruism emerges across rounds
- Context framing shapes cooperative tendency

## Analytical Framework

Authors propose a framework that captures:
1. **Dynamics across rounds** — how reasoning evolves
2. **Fairness weighting** — explicit equity considerations
3. **Context sensitivity** — non-zero-sum framing effects

## Implications for Our System

### Multi-Agent Coordination
- LLM agents may **over-cooperate** in competitive scenarios
- Fairness reasoning can be harnessed for alignment
- Round-by-round context building matters

### Design Considerations
| Scenario | Expected Behavior | Mitigation |
|----------|-------------------|------------|
| Resource competition | May over-share | Explicit cost modeling |
| Negotiation tasks | May concede too much | Clear utility functions |
| Collaborative tasks | Natural alignment | Build on fairness instinct |

## Hypothesis Opportunity

**H-XXX:** Can we leverage fairness reasoning as a coordination mechanism? If agents naturally seek equitable outcomes, explicit fairness constraints may improve multi-agent alignment without complex incentive engineering.

## Citation
```
arXiv:2604.00487 [cs.MA]
Competition and Cooperation of LLM Agents in Games
```

---
**Discovered:** 2026-04-05  
**Relevance:** Medium-High — explains emergent cooperative behavior in MAS
