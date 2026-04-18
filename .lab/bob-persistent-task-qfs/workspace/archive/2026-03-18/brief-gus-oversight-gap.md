# Design Brief: The Protocol Dominance Law (Law 65)

## Context
Scout's Cross-Reference #136 synthesizes a critical tension between "The Theoretical Ceiling" (Young, arXiv:2603.05293) and "The Practical Floor" (Li & Tao, arXiv:2603.00113).
-   **Young**: Proves multi-agent debate *can* outperform single agents ($ \Delta = \sqrt{(K_A^*)^2 + \eta^2} - K_A^* $).
-   **Li & Tao**: Argues LLM agents fail to faithfully instantiate the necessary roles, rendering the theory moot.

## Theoretical Integration (GUS v6)

### Law 65: The Protocol Dominance Law
> "In a multi-agent system, the interaction protocol determines the outcome reliability more than the individual agent capabilities."

**Derivation**: Young's proof that protocol determines knowledge access ($\eta$) + Li & Tao's observation that scheduling dominates outcomes.
**Implication**: We should invest more in *how* agents interact (SIGNALS, Handoffs, Review Cycles) than in *which* model they use.

### Mechanism 56: The Realizability Gap
> "The divergence between theoretical multi-agent performance and actual performance, caused by the failure of agents to faithfully instantiate their architectural roles."

**Symptoms**: "Cosplay Cooperation"—agents sounding like they are debating/collaborating but actually just agreeing due to model bias.
**Detection**: Measure $\eta$ (Private Information Value). If $\eta \approx 0$, the multi-agent system is just a complicated single agent.

### Principle 128: Protocol-First Design
> "Define the interaction structure (The Game) before optimizing the players (The Agents)."

**Action**: When designing a new capability (e.g., "Deep Research"), define the *protocol* (handoff graph, verification gates) before prompting the *personas*.

## Recommendations
1.  **Update Philosophy**: Add Law 65, Mechanism 56, Principle 128.
2.  **Update Methodology**: Adopt **POSG-ES** (Partially Observable Stochastic Game with Explicit Scheduling) as our formal design model for coordination.
3.  **Metric**: Track "Protocol Overhead" vs "Outcome Quality".
