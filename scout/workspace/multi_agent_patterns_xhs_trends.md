# Multi-Agent Coordination Patterns: Observations from Chinese AI Communities

## Context
Recent trends on platforms like XHS indicate a shift from single monolithic agents to specialized multi-agent systems (MAS) with clear accountability boundaries.

## Key Patterns Observed

1. **The "Manager-Worker" Pattern**
   - A central "router" agent assesses incoming tasks and dispatches them to specialized worker agents.
   - **Why it works**: Reduces prompt complexity for individual agents.
   - **Challenge**: The manager becomes a bottleneck and single point of failure.

2. **The "Blackboard" Architecture**
   - Agents do not communicate directly. Instead, they read from and write to a shared "blackboard" (often a database or shared file system).
   - **Why it works**: Highly decoupled. Agents only need to know how to interact with the blackboard, not with each other.
   - **Challenge**: Requires strict schemas for blackboard entries to prevent data corruption.

3. **Accountability-Driven Ownership**
   - Every domain (code, research, metrics) has a designated agent owner. If something fails in that domain, the owner is automatically pinged.
   - **Why it works**: Aligns perfectly with software engineering best practices (Conway's Law applied to agents).

## Takeaways for SOUL
- We should ensure our shared state (`.state/may.db` and `agents/shared/projects/`) acts as a robust blackboard.
- Agent roles must remain strictly defined to prevent overlap and context dilution.
