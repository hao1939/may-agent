# DD#512 — The Self-Driving Portfolio: 50-Agent Architecture for Institutional Asset Management

**Paper:** arXiv:2604.02279 — "The Self Driving Portfolio: Agentic Architecture for Institutional Asset Management"
**Authors:** Andrew Ang, Nazym Azimbayev, Andrey Kim
**Published:** April 2, 2026
**Tags:** #multi-agent-scale #voting #meta-agent #self-improvement #institutional-governance #portfolio-management

## Why This Matters (★★★★)

This is the **largest documented specialized MAS pipeline** we've seen in the research literature: ~50 agents collaborating on a single complex decision (strategic asset allocation). The architecture combines several patterns we've studied independently — voting, critique, meta-learning, researcher agents — into a production-oriented system for institutional finance. The meta-agent that rewrites other agents' code and prompts is the most concrete implementation of self-improving MAS governance we've encountered.

## Architecture Overview

### Agent Taxonomy (~50 agents)
The pipeline decomposes institutional asset management into specialized agent roles:

1. **Capital Market Assumption (CMA) Agents** — Multiple agents that independently produce forward-looking return/risk/correlation estimates using different methodologies (fundamental, statistical, macro-regime, etc.)
2. **Portfolio Construction Agents** — 20+ agents implementing competing portfolio optimization methods (mean-variance, risk parity, Black-Litterman, factor-based, etc.)
3. **Critique Agents** — Agents that evaluate and challenge other agents' outputs, checking for consistency, bias, regime-sensitivity
4. **Voting Agents** — Agents that vote on each other's output to produce ensemble decisions
5. **Researcher Agent** — Proposes new portfolio construction methods not yet represented in the pipeline
6. **Meta-Agent** — Compares past forecasts against realized returns; **rewrites agent code and prompts** to improve future performance

### Key Design Patterns

**Pattern 1: Competing Methods, Not Competing Agents**
Each portfolio construction agent implements a *different methodology*, not the same method with different parameters. This is methodological diversity, not stochastic diversity. The ensemble captures genuine disagreement about the right approach.

**Pattern 2: Investment Policy Statement as Constitutional Document**
The IPS — the same document human portfolio managers follow — serves as the **governing constraint** for all agents. This is a direct analog to our Constitutional AI patterns: a natural-language governance document that bounds autonomous agent behavior.

**Pattern 3: Critique-and-Vote Pipeline**
Rather than simple averaging, agents critique each other's outputs and then vote. This creates an adversarial-collaborative dynamic that surfaces weaknesses before decisions are made.

**Pattern 4: Meta-Agent Code Rewriting**
The meta-agent doesn't just adjust parameters — it rewrites code and prompts of other agents based on realized performance. This is **genuine self-modification** of the multi-agent system, not just hyperparameter tuning.

**Pattern 5: Researcher Agent as Exploration Mechanism**
A dedicated agent proposes entirely new methods, preventing the system from converging on a fixed set of approaches. This addresses the exploitation-exploration tradeoff at the system level.

## Connections to Our Research

### Scale Patterns
At ~50 agents, this validates several predictions from our scaling research:
- **DD#219 (Science of Scaling)**: The specialization-per-agent approach aligns with the "narrow specialist" scaling pattern
- **DD#481 (Coordination Protocols)**: Voting + critique is a hybrid coordination mechanism
- **DD#484 (OrgAgent)**: Company-style hierarchy for MAS — this is an independent validation of hierarchical organization

### Self-Improvement Loop
The meta-agent pattern is a concrete instance of what we've theorized:
- **DD#509 (Self-Distillation)**: The meta-agent's code rewriting is a form of system-level self-distillation
- **CR#277 (Memory Control Loop)**: The meta-agent closing the loop between past predictions and future behavior

### Governance
The IPS-as-constitution pattern directly maps to:
- **DD#503 (Governed Memory)**: External governance documents constraining agent behavior
- **CR#262 (Governance Resilience Architecture)**: Natural-language governance for autonomous systems

## Key Insights for Our System

1. **Methodological diversity > stochastic diversity**: Having 20 agents doing different methods beats 20 instances of the same method with different seeds
2. **Natural-language governance documents work**: The IPS proves that real-world governance documents can effectively constrain MAS behavior
3. **Self-modifying meta-agents are viable**: Code/prompt rewriting based on realized outcomes is a practical self-improvement mechanism
4. **Researcher agents prevent convergence**: Dedicated exploration agents keep the system from ossifying
5. **Scale works for structured domains**: 50 agents is manageable when the domain is well-structured and roles are clearly defined

## Hypotheses Generated

- **H-053: Methodological Diversity Scaling** — In specialized MAS, performance scales with methodological diversity (number of distinct approaches) more than with agent count within a single methodology. Testable by comparing N-method ensembles vs N-copies-of-best-method.
- **H-054: Meta-Agent Convergence Risk** — Self-modifying meta-agents that rewrite other agents' code will converge to a narrower set of approaches over time unless explicitly constrained by diversity requirements. The researcher agent is a necessary counterbalance.

## Limitations

- Domain-specific to institutional finance — not all MAS domains have such clear role decomposition
- 31 pages but no open-source implementation described
- Performance comparison with simpler ensembles not fully detailed in abstract
- The IPS constraint assumes a well-specified governance document; many domains lack this

## Filed
- Paper logged in papers.md
- Cross-referenced with DD#219, DD#481, DD#484, DD#503, DD#509
- H-053, H-054 generated
