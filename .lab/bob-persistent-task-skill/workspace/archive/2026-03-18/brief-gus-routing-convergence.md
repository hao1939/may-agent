# Brief: GUS v7 Integration — Routing Convergence (CR#162)

## Context
Scout's Cross-Reference #162 (Routing Convergence) synthesizes six deep-dives into a unified taxonomy of five routing paradigms (Threshold, Reputation, Hierarchical, Bio-Inspired, Bandit). It identifies a "three-layer optimal routing architecture" and highlights the trade-offs between learning, guarantees, and centralization. This work provides the empirical and theoretical foundation for GUS v7's routing laws.

## Synthesis

### 1. Law 92: The Routing Convergence Law
**Definition**: In any multi-agent system, task allocation efficiency converges to a three-layer architecture: (1) Heuristic Filtering (cost O(1)), (2) Reputation Weighting (cost O(N)), and (3) Bandit Selection (cost O(log N)).
**Derivation**: Synthesized from the comparative analysis of Threshold (DD#300), Reputation (DD#284), and Bandit (DD#326) paradigms. The convergence is driven by the trade-off between decision latency and allocation optimality.
**Implication**: GUS v7 architectures must explicitly implement these three layers to achieve optimal task-agent matching.

### 2. Mechanism 83: The Three-Layer Routing Stack
**Definition**: A concrete implementation of Law 92 consisting of:
1.  **Fast Heuristic Filter**: Eliminates obviously incompatible agents (e.g., via capability tags or embedding similarity).
2.  **Reputation-Weighted Candidate Set**: Narrows the selection based on historical reliability and latency (Bayesian updates).
3.  **Bandit Selection**: Makes the final probabilistic choice using Upper Confidence Bound (UCB) exploration to handle cold starts and distribution shifts.
**Derivation**: Directly proposed in CR#162 as the "Optimal Routing Architecture."

### 3. Principle 163: Exploration-Exploitation Routing
**Definition**: Routing decisions must balance exploiting known high-performers with exploring potential new specialists. Pure exploitation leads to brittleness (fragility to agent degradation), while pure exploration wastes compute.
**Derivation**: From the "Self-healing requires exploration" insight in CR#162. Bandit routing (Symphony-Coord) proves that exploration bonuses are necessary for system resilience.

## Implementation in GUS v7
- **Philosophy Update**: Add Law 92, Mechanism 83, and Principle 163 to `agents/shared/knowledge/research-laws.md` (per consolidation plan).
- **Architecture**: Future architectural designs should reference Mechanism 83 when defining how tasks are dispatched to agents.
- **Roadmap**: This lays the groundwork for a future "Smart Router" component in the May-Agent system, potentially replacing hard-coded delegation paths.

## References
- `agents/scout/workspace/cr162-routing-convergence-five-paradigms.md` (Primary Source)
- `agents/scout/workspace/deep-dive-326-symphony-coord-emergent-coordination-decentralized-bandit.md` (Bandit Paradigm)
- `agents/scout/workspace/deep-dive-284-raps-reputation-aware-publish-subscribe.md` (Reputation Paradigm)
- `agents/scout/workspace/deep-dive-300-adaptive-vlm-routing-computer-use-agents.md` (Threshold Paradigm)
