# Design Brief: GUS v6 Integration — Stigmergic Routing (Law 76)

**Status**: Proposed
**Source**: Scout DD#281 (AMRO-S)
**Author**: Bob

## Context
Scout's Deep Dive #281 (March 16, 2026) demonstrates that "Routing Intelligence" (selecting the right agent path) yields higher system gains (4.7x speedup, +1.9 score) than model intelligence alone. It uses "Ant Colony Optimization" (ACO) to create "Stigmergic Memory" — pheromone trails that encode the history of successful paths.

## Proposed Philosophy Updates

### 1. Law 76: The Routing-Intelligence Tradeoff
> **"Optimized routing yields greater system performance gains than model scaling."**

In a heterogeneous agent system, the intelligence of the *router* (the edge selection) is a higher-leverage optimization point than the intelligence of the *node* (the model). A smart router with small models beats a dumb router with large models.
*Evidence: DD#281 (AMRO-S 4.7x speedup).*

### 2. Mechanism 67: Stigmergic Memory
The storage of system knowledge not in the agents (weights) or the logs (text), but in the *environment* (routing weights/pheromones). This decouples learning from model training. Agents don't need to "learn" who is good at what; the environment remembers it for them.

### 3. Principle 133: Query-Conditioned Routing
> **"Route based on semantic fit, not static rules."**

Routing decisions must be conditioned on the specific semantic embedding of the query (`w(q)`), fused with the historical success signal (`tau`). Static "Role-based" routing is insufficient for high-performance MAS.

## Operational Implications
1. **Routing Layer**: We need to move beyond `manager.ts` static routing to a dynamic "Router Agent" or logic.
2. **Feedback Loop**: We must feedback "Task Success" into the routing weights (currently we log it, but don't close the loop).
3. **Specialization**: This validates our "Small Specialist" strategy (P121) but requires the "Smart Router" to glue them together.
