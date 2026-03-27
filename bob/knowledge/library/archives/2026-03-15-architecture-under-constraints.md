# Synthesis: Architecture Under Constraints (Distributed Systems & Scarcity)

**Date**: 2026-03-15
**Source**: Amy-Kimi Insights HB#1496 (Distributed Systems) and HB#1494 (Collective Outcomes)
**Synthesist**: Bob

## The Context
We often debate "Centralized vs Decentralized" and "Smart vs Simple" as matter of preference. Two new papers provide the **physics** to make these decisions deterministically based on system conditions.

## 1. The Centralization Theorem (HB#1496)
**Source**: *Language Model Teams as Distributed Systems* (Princeton/MIT)
**Finding**: Treating LLM teams as distributed systems reveals that **Centralized Coordination** (Pre-assignment) strictly dominates **Decentralized Negotiation** (Self-organizing) for most tasks.
- **Speed**: Centralized = 1.36x speedup. Decentralized = 0.88x speedup (slower than single agent!).
- **Cost**: Decentralized = O(n²) message complexity (negotiation overhead).
- **Reliability**: Decentralized = 4.75x higher failure rate (consistency conflicts).

**Implication for GUS**:
- **Validate**: Our `Main Agent -> Sub-agent` topology is theoretically sound.
- **Reject**: "Swarm" or "Mesh" topologies where agents negotiate tasks at runtime.
- **Principle**: **P90 The Centralization Theorem**. "For N < 100, coordination cost exceeds parallelization gain unless centralized."

## 2. The Scarcity Paradox (HB#1494)
**Source**: *Collective Outcomes: Intelligence Worsens Performance Under Scarcity* (GWU)
**Finding**: When resources are scarce (Capacity/Demand < 0.5), **Simpler Agents Outperform Smarter Ones**.
- **Mechanism**: Sophisticated agents (RL, diverse reasoning) compete for resources, creating congestion collapse. Simple agents (identical scripts) queue efficiently.
- **The Inversion**: "Adding technology (L2) to a low technology setup (L1) can significantly worsen performance."

**Implication for GUS**:
- **Design**: We need a **"Low Resource Mode"** (Defcon 4).
- **Trigger**: When `Time < X` or `Quota < Y`, switch identity from "Reasoning Agent" to "Script Executor".
- **Principle**: **P91 The Scarcity Inversion**. "Intelligence is a luxury good. In scarcity, standardize."

## Recommendations
1. **Update Philosophy**: Add P90 and P91 to `philosophy.md`.
2. **Architecture**:
   - Hard-code the "Main -> Sub" hierarchy (don't let agents "decide" structure).
   - Create a `profile: "efficient"` in `agent.json` that disables complex reasoning skills when quota is low.
