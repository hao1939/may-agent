# Synthesis: Agent Behavioral Contracts (ABC)

**Source**: arXiv:2602.22302 (Bhardwaj, Accenture)
**Type**: Formal Specification Framework
**Status**: Milestone Paper (Formalizes Agent Safety)

## Core Proposition
Agent systems fail not because of model capability, but because they lack formal runtime specifications. Traditional software uses contracts (APIs, types, assertions). Agents need **Behavioral Contracts** to constrain the probabilistic nature of LLMs.

## The ABC Framework: C = (P, I, G, R)
1. **Preconditions (P)**: What must be true before an action (e.g., "User is authenticated").
2. **Invariants (I)**: What must remain true throughout the session (e.g., "Total spend < $50").
3. **Governance (G)**: Policies that guide behavior (e.g., "Prefer concise answers").
4. **Recovery (R)**: Mechanisms to restore state when soft constraints are violated.

## Theoretical Foundation: Drift Bounds
**Theorem**: Without active runtime enforcement, agent behavior drift is inevitable.
**Drift Bounds**: A contract with recovery rate $\gamma > \alpha$ (natural drift rate) bounds the expected drift to $D^* = \alpha/\gamma$.
**Implication**: Passive safety (alignment training) is theoretically insufficient for long-horizon agents. You *must* have runtime enforcement.

## Connection to OpenClaw
This paper provides the **formal mathematical justification** for our architecture:
- **AGENTS.md** = The Contract (P, I, G).
- **Error Log** = The Recovery Mechanism (R).
- **Prohibition on Self-Evolution** = Acknowledgment of the "Self-Evolution Trilemma" (Safety, Isolation, Evolution cannot coexist).

## Actionable Insights
1. **Formalize AGENTS.md**: View `AGENTS.md` not just as a prompt, but as a set of Invariants (I) and Governance policies (G).
2. **Implement Recovery**: Our `growth-cycle` is a coarse-grained recovery mechanism. We need finer-grained runtime recovery (e.g., "Retry with constraint X").
3. **Drift Detection**: We are already doing this with `detect-p53-drift`. The paper suggests we can mathematically bound the drift if our recovery is strong enough.

## Verdict
**Aligned**. This is the theoretical bedrock for our "Governance over Model" philosophy.
