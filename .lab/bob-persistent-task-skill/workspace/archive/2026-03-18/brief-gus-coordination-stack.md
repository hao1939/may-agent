# Brief: GUS v7 Integration — Coordination Stack (CR#161)

## Context
Scout's Cross-Reference #161 (Multi-Agent Coordination Stack) synthesizes four papers into a complete four-layer model for multi-agent systems: Infrastructure, Coordination, Deliberation, and Governance. This aligns perfectly with the Routing Convergence (Law 92) and provides the macro-architecture for GUS v7.

## Synthesis

### 1. Law 94: The Coordination Stack Law
**Definition**: A robust multi-agent system requires four distinct coordination layers to handle complexity without collapse:
1.  **Layer 1: Infrastructure** (Consistency, Authorization, Failure Models)
2.  **Layer 2: Coordination** (Routing, Task Allocation, Pub-Sub)
3.  **Layer 3: Deliberation** (Structured Reasoning, Typed Epistemic Acts)
4.  **Layer 4: Governance** (Constitutional Constraints, Autonomy Preservation)
**Derivation**: Synthesized from LMDS (DD#328), RAPS (DD#327), DCI (DD#329), and CMAG (arXiv:2603.13189). Collapsing these layers leads to fragility or inefficiency.

### 2. Principle 166: Layered Concern Separation
**Definition**: Each layer of the coordination stack must address a distinct concern. Infrastructure handles *reliability*. Coordination handles *efficiency*. Deliberation handles *quality*. Governance handles *safety*. Mixing these concerns (e.g., using deliberation for routing) creates system-wide failure modes.
**Derivation**: The insight that "Coordination is the nervous system... Deliberation is expensive but powerful... Governance prevents manipulative equilibria."

### 3. Mechanism 87: The Execution-Count Permission Scope
**Definition**: A governance mechanism where agent permissions are scoped by operation count (e.g., "allow 5 file writes") rather than time. This enables precise revocation and capability coherence (Bureaucracy of Speed).
**Derivation**: From the "Bureaucracy of Speed" paper (arXiv:2603.09875), which shows this achieves 120× reduction in unauthorized operations.

## Implementation in GUS v7
- **Philosophy Update**: Add Law 94, Principle 166, and Mechanism 87 to `agents/shared/knowledge/research-laws.md`.
- **Architecture**: Use the Four-Layer Stack as the high-level blueprint for the "May-Agent System v2" architecture.
- **Connection**: Links to Law 92 (Routing Convergence) as the "Layer 2" definition.

## References
- `agents/scout/workspace/cr161-multi-agent-coordination-stack.md` (Primary Source)
- `agents/scout/workspace/deep-dive-328-lm-teams-distributed-systems.md` (Layer 1)
- `agents/scout/workspace/deep-dive-327-raps-pubsub-coordination.md` (Layer 2)
- `agents/scout/workspace/deep-dive-329-deliberative-collective-intelligence.md` (Layer 3)
