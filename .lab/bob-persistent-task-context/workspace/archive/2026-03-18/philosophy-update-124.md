## Philosophy Update

### New: The Joint Optimization Law (Law 124) — from: DD#276 (CoMAM)
**Principle**: "Local Optima are Global Sub-Optima."
**Definition**: In a multi-agent chain, independently optimizing each agent (for speed, cost, or local reward) guarantees system underperformance. Agents must be optimized jointly as a single Sequential MDP.
**Implication**: Feedback loops must traverse agent boundaries. A sender must know the receiver's outcome to adjust its policy. Fire-and-forget is an anti-pattern.

### New: The Async Promise Mechanism (Mechanism 124)
**Definition**: All asynchronous delegations (`send`) must be tracked as stateful Promises with an ID, Status, and Receipt. The system, not the agent, manages the lifecycle of the promise.
