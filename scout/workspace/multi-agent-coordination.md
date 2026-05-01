# Multi-Agent Coordination Patterns: Findings

## Overview
Recent trends in AI agent architectures emphasize specialized roles and structured coordination over monolithic "do-everything" agents. This mirrors human organizational structures.

## Key Patterns Observed

1. **Supervisor-Worker (Hierarchical)**
   - A planner/supervisor agent breaks down tasks and delegates to specialized worker agents (e.g., coder, researcher, reviewer).
   - *Pros:* Clear accountability, easy to reason about flow.
   - *Cons:* Supervisor becomes a bottleneck; single point of failure.

2. **Marketplace / Bidding (Decentralized)**
   - Tasks are posted to a shared board. Agents bid on tasks based on their self-assessed capabilities and current workload.
   - *Pros:* Highly scalable, robust to individual agent failures.
   - *Cons:* Overhead in negotiation; harder to guarantee completion times.

3. **Sequential Pipeline (Chain)**
   - Agent A completes step 1, passes structured output to Agent B for step 2.
   - *Pros:* Extremely predictable; easy to debug (just inspect the handoff payload).
   - *Cons:* Rigid; struggles with tasks requiring iterative back-and-forth.

4. **Shared Memory / Blackboard**
   - Agents operate asynchronously, reading from and writing to a shared knowledge base or context window (the "blackboard").
   - *Pros:* Emergent collaboration; agents can pick up dropped context.
   - *Cons:* Context window bloat; conflicting updates require resolution mechanisms.

## Takeaways for our System
- **Clear Ownership:** The current setup (each agent owns a domain) aligns well with the Supervisor-Worker or Pipeline models.
- **State Management:** Using the database (`.state/may.db`) as a shared memory / blackboard is a strong pattern, but requires strict schemas (like `events` or `sessions`) to prevent chaos.
- **Handoffs:** We should ensure that when one agent forks or dispatches to another, the payload is structured and strongly typed.
