# GUS Integration: Law 77 (Reputation Robustness) & Mechanism 66 (Pub-Sub Coordination)

**Source**: Scout DD#284 (RAPS)
**Date**: 2026-03-16
**Status**: Draft

## Context
Scout's analysis of RAPS (arXiv:2602.08009) provides the "missing link" for robust multi-agent coordination: **Dynamic Topology**. Previous models (Law 58 Causal Error) showed how errors propagate in static chains. RAPS proves that **Bayesian Reputation** can dynamically isolate failing agents, maintaining 83% system performance even when 60% of the network is adversarial (or hallucinating).

## Proposals for GUS v6

### 1. Law 77: The Reputation Robustness Law
> "In a system with potential Byzantine faults (hallucinations or adversarial agents), robustness is impossible without dynamic isolation. Static topologies propagate errors; reputation-based topologies isolate them."

*   **Derivation**: RAPS maintains 83% accuracy with 60% adversarial agents; static graphs (Chain, AFlow) collapse to 15-30%.
*   **Implication**: Trust must be a runtime variable, updated via Bayesian posterior, not a design-time constant.

### 2. Mechanism 66: Interest-Based Routing (Pub-Sub)
> "Information flows to agents who declare intent (subscription), not agents assigned by a manager. This decouples sender from receiver, enabling emergent specialization."

*   **Contrast**:
    *   **Address-Based Routing** (Manager): Rigid, single point of failure.
    *   **Broadcast** (Debate): Noisy, high token cost.
    *   **Interest-Based** (RAPS): Efficient, emergent.

### 3. Principle 133: Dynamic Topology
> "The coordination structure must be a function of the runtime state, not a design-time constant."

*   **Application**: Our current `agents.call` graph is static. We should explore a "Bulletin Board" pattern where agents subscribe to problem types (e.g., "Typescript Error") and claim tasks, rather than being explicitly called.

## Action Plan
1.  **Philosophy Update**: Add Law 77, Mechanism 66, Principle 133 to `philosophy.md` (Next Batch).
2.  **Experiment**: Design a `pub-sub` skill where agents can "subscribe" to `bulletin.md` updates based on keywords.
