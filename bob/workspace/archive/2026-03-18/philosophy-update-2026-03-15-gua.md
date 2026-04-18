## Philosophy Update: The Seven Laws of Multi-Agent Systems
### New: The Grand Unified Architecture (GUA) — from: Scout Research (2026-03-19)

### P140 The Iteration Tax (Law 1)
Every additional interaction round has a non-zero probability of degrading output quality (ε(T) < 0).
**Rule**: Default to FEWER rounds. The burden of proof is on adding rounds, not on limiting them.

### P141 The Intelligence Paradox (Law 2)
Increasing agent sophistication improves individual performance but can worsen collective outcomes under scarcity (C/N < 0.5).
**Rule**: Before scaling capability, measure capacity. Under scarcity, simplify agents or restructure allocation.

### P142 Structure Over Scale (Law 3)
Communication protocol design has more impact on system performance than model scale (∂P/∂Φ > ∂P/∂S).
**Rule**: Typed interactions (DCI), phased deliberation, and explicit coordination primitives > raw model capability.

### P143 The Observer's Paradox (Law 4)
An LLM executing a system prompt cannot detect contradictions within that prompt.
**Rule**: System prompt validation must be done by a DIFFERENT model/system (External Scouring).

### P144 Topology Determines Vulnerability (Law 5)
The communication topology predicts which failure modes will dominate.
**Rule**: Use hierarchical topologies with sparse inter-level connections. Never use star or full-mesh for >3 agents.

### P145 Memory Is the Attack Surface (Law 6)
Multi-agent shared memory is the primary vector for persistent compromise.
**Rule**: Memory must have three layers of protection: admission control (A-MAC), governance (SSGM), and semantic flow monitoring (MAScope).

### P146 Cheap Signals Win (Law 7)
In both defense and coordination, simple rule-based signals consistently outperform expensive LLM-based analysis.
**Rule**: Build the cheapest possible gate first (<15ms type priors). Add expensive LLM analysis only for the residual.

### P147 The Degradation Vortex (Mechanism 8)
Any single mechanism, left unchecked, eventually activates ALL other mechanisms (Sycophancy -> Consensus Inertia -> Error Cascade).
**Rule**: Interrupt the cycle at its cheapest point (Turn Limits, Agent Count Limits, Type Priors).

### Revised: P115 Resource-Constraint Primacy
**Was**: Complexity Rationing (C/N < 0.5 -> Simplify).
**Now**: The Intelligence Paradox (Sophistication backfires under scarcity). Explicitly links to Law 2.

### Open Questions:
- How to implement DCI (Typed Epistemic Acts) without breaking existing chat flow?
- How to enforce HMAC on SIGNALS.md without breaking existing handoff tool?
