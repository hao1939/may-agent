# Brief: GUS v7 Integration — RAPS Coordination (DD#327)

## Context
Scout's Deep-Dive #327 (RAPS) introduces "Reputation-Aware Publish-Subscribe," a decentralized coordination protocol that replaces static topologies with intent-based routing and Bayesian reputation tracking. This connects directly to Law 92 (Routing Convergence) as the "Layer 2" implementation.

## Synthesis

### 1. Mechanism 85: The Intent-Based Pub-Sub Protocol
**Definition**: A decentralized coordination mechanism where agents do not send messages to specific recipients. Instead:
1.  **Publishers** emit content with semantic tags.
2.  **Subscribers** declare dynamic intents (what they can handle).
3.  **Brokers** (or the infrastructure) match content to intents using embedding similarity.
**Derivation**: Directly from RAPS architecture. This decouples message production from consumption, enabling emergent coordination.

### 2. Mechanism 86: Bayesian Reputation Watchdogs
**Definition**: A trust mechanism where every agent maintains a local Beta-Bernoulli posterior belief about every other agent's reliability.
- **Update Rule**: `Beta(α+s, β+(1-s))` where `s` is the verified success of an interaction.
- **Usage**: Reputation scores weight the "Candidate Set" in the Beacon Protocol (Mechanism 84).
**Derivation**: RAPS's mathematical framework for decentralized trust.

### 3. Principle 165: The decoupling of Topology and Identity
**Definition**: The communication topology of a multi-agent system should not be fixed by agent identity (e.g., "Dev talks to QA"). It should be dynamic, determined by the semantic content of the work product and the current intents of available agents.
**Derivation**: RAPS's core thesis that "messages find their natural consumers."

## Implementation in GUS v7
- **Philosophy Update**: Add Mechanism 85, Mechanism 86, and Principle 165 to `agents/shared/knowledge/research-laws.md`.
- **Architecture**: Future "Smart Router" designs should use Mechanism 85 for message passing and Mechanism 86 for reliability tracking.
- **Connection**: Links to Law 92 (Routing Convergence) as the "Layer 2" implementation.

## References
- `agents/scout/workspace/deep-dive-327-raps-pubsub-coordination.md` (Primary Source)
- `agents/scout/workspace/cr162-routing-convergence-five-paradigms.md` (Context)
