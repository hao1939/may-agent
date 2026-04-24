# Design Brief: GUS v6 Integration — Strategic Risk Aversion (SRPO)

**Source**: `agents/scout/workspace/deep-dive-arxiv-2602-21515-strategic-risk-aversion-collaborative-agents.md` (SRPO, Caltech)
**Status**: PROPOSED
**Target**: GUS v6 / Philosophy.md

## 1. Executive Summary
Scout's deep-dive into SRPO (Strategic Risk-Averse Policy Optimization) reveals a counter-intuitive "Free Lunch" theorem for multi-agent systems: **optimizing for worst-case partner deviation (Risk Aversion) actually improves shared performance**. This contradicts the standard trade-off where robustness costs performance. In collaborative settings, risk aversion eliminates "Free-Riding" (a major failure mode in our system) and forces robust contribution.

## 2. Theoretical Integration

### New Law 41: The Robustness-Performance Free Lunch
> "In collaborative multi-agent systems, increasing strategic risk aversion ($\tau$) monotonically increases shared reward up to a critical phase transition where free-riding equilibria vanish."

**Implication**: We should not assume "perfect coordination" (Nash). We should assume "partners might fail" (Risk Averse). This forces agents to be self-reliant and robust, which paradoxically leads to better team performance.

### New Principle 102: Strategic Risk Aversion (SRA)
> "Design agents to optimize for the worst-case deviation of their partners, not the best-case. If an agent assumes its partner might drop the ball, it will ensure the ball is caught. When all agents do this, the system becomes anti-fragile."

### New Mechanism 33: Adversarial Partner Modeling
> "Model partner behavior as $P_{partner} = P_{observed} + \Delta_{adversarial}$. Optimize your action against this perturbed policy."

## 3. Practical Application (Our System)
We currently suffer from "Optimistic Handoffs" — agents assume the receiver will perfectly understand and execute the task (P82 violations).
**The Fix**:
1. **Pessimistic Handoffs**: The sender must assume the receiver *will* misunderstand or fail.
2. **Redundancy by Default**: Include context, verification steps, and "what if" instructions.
3. **Escalation as Default**: If a tool *might* fail, handle the error immediately (Risk Aversion), don't wait for a retry loop.

## 4. Recommendations
1. **Philosophy Update**: Add Law 41 and P102 to `agents/shared/philosophy.md`.
2. **Evaluator Update**: Penalize "Optimistic Assumptions" in handoffs. Reward "Defensive Coordination".
3. **Gym Update**: Create a "Flaky Partner" scenario where the other agent randomly drops tasks or hallucinates. Verify that the tested agent can still succeed (e.g., by double-checking or implementing retries).
