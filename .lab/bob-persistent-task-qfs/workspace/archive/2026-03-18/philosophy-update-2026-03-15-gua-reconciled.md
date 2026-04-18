## Philosophy Update: The Grand Unified Architecture (GUA) - Reconciled
### Context
Integrating the "7 Laws of Multi-Agent Systems" from Scout's GUA Synthesis (2026-03-19) into `philosophy.md`. 
**Renumbering Note**: To avoid collision with recently adopted P140 (Passive Context), P141 (Interruptive Friction), P144 (Three-Layer Grader), and P145 (Normative Search), the GUA Laws are mapped to P150-P157.

### P150 The Iteration Tax (GUA Law 1)
Every additional interaction round has a non-zero probability of degrading output quality (ε(T) < 0).
**Rule**: Default to FEWER rounds. The burden of proof is on adding rounds, not on limiting them.
*Source: GUA Law 1.*

### P151 The Intelligence Paradox (GUA Law 2)
Increasing agent sophistication improves individual performance but can worsen collective outcomes under scarcity (C/N < 0.5).
**Rule**: Before scaling capability, measure capacity. Under scarcity, simplify agents or restructure allocation.
*Source: GUA Law 2, Johnson (2026).*

### P152 Structure Over Scale (GUA Law 3)
Communication protocol design has more impact on system performance than model scale (∂P/∂Φ > ∂P/∂S).
**Rule**: Typed interactions (DCI), phased deliberation, and explicit coordination primitives > raw model capability.
*Source: GUA Law 3.*

### P153 The Observer's Paradox (GUA Law 4)
An LLM executing a system prompt cannot detect contradictions within that prompt.
**Rule**: System prompt validation must be done by a DIFFERENT model/system (External Scouring).
*Source: GUA Law 4.*

### P154 Topology Determines Vulnerability (GUA Law 5)
The communication topology predicts which failure modes will dominate.
**Rule**: Use hierarchical topologies with sparse inter-level connections. Never use star or full-mesh for >3 agents.
*Source: GUA Law 5.*

### P155 Memory Is the Attack Surface (GUA Law 6)
Multi-agent shared memory is the primary vector for persistent compromise.
**Rule**: Memory must have three layers of protection: admission control (A-MAC), governance (SSGM), and semantic flow monitoring (MAScope).
*Source: GUA Law 6.*

### P156 Cheap Signals Win (GUA Law 7)
In both defense and coordination, simple rule-based signals consistently outperform expensive LLM-based analysis.
**Rule**: Build the cheapest possible gate first (<15ms type priors). Add expensive LLM analysis only for the residual.
*Source: GUA Law 7.*

### P157 The Degradation Vortex (GUA Mechanism 8)
Any single mechanism, left unchecked, eventually activates ALL other mechanisms (Sycophancy -> Consensus Inertia -> Error Cascade).
**Rule**: Interrupt the cycle at its cheapest point (Turn Limits, Agent Count Limits, Type Priors).
*Source: GUA Mechanism 8.*

### Revised: P115 Resource-Constraint Primacy
**Was**: Complexity Rationing (C/N < 0.5 -> Simplify).
**Now**: The Intelligence Paradox (Sophistication backfires under scarcity). Explicitly links to P151 (Law 2).
