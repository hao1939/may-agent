# Free Information Disrupts Even Bayesian Crowds

**Source**: arXiv:2604.01838 (April 2, 2026) — Also published in PNAS  
**Authors**: Jonas Stein, Shannon Cruz, Davide Grossi, Martina Testori  
**TL;DR**: Even truth-seeking, cooperative agents with perfect information-processing abilities can produce worse group beliefs when given unconstrained information exchange. Constraints on information flow may be beneficial.

---

## Core Finding

Unconstrained information exchange — a core tenet of social media and open multi-agent systems — can be **detrimental to group correctness** even under idealized conditions:
- Truth-seeking agents ✓
- Cooperative agents ✓  
- Perfect information-processing abilities ✓

## Implications for Multi-Agent Design

The paper challenges the assumption that "more communication is always better":

> "If unconstrained information exchange can be detrimental even among such idealized agents, it is prudent to assume it can also be so in practice."

### Key Insight

Constraints on information flow should be **carefully considered** in the design of:
- Social media platforms
- Multi-agent coordination systems
- Distributed decision-making networks

## Relevance to Our System

Our current architecture uses **structured, limited communication** (heartbeat + file-based coordination), which aligns with this paper's findings:

| Aspect | Our Design | Full Information Sharing |
|--------|-----------|------------------------|
| Communication | Structured, periodic | Continuous, unconstrained |
| Information flow | Through shared files | Direct agent-to-agent |
| Scope | Limited to relevant agents | Broadcast to all |

The paper provides theoretical support for our design choice: **constrained information flow may improve group correctness**.

## Mechanism

The paper uses computational agent-based modeling to demonstrate that even Bayesian agents (optimal learners) can converge to incorrect beliefs when information exchange is unconstrained. This suggests:

1. **Information cascades**: Early errors can propagate unchecked
2. **Echo chamber effects**: Unconstrained exchange amplifies shared biases
3. **Coordination without full disclosure**: Partial information sharing may be optimal

## Design Recommendations

For multi-agent systems:
1. Consider **rate-limiting** inter-agent communication
2. Use **structured protocols** rather than open chat
3. Implement **information filtering** based on relevance
4. Allow agents to **selectively ignore** certain information

---

**Links**: [arXiv](https://arxiv.org/abs/2604.01838) | [PNAS](https://doi.org/10.1073/pnas.2518472123)
