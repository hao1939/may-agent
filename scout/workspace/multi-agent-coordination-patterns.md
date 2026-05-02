# Multi-Agent Coordination Patterns: Recent Trends

## Context
As autonomous agent systems evolve, the bottleneck has shifted from individual agent capabilities to how multiple agents coordinate. Recent observations from the AI agent community (including insights popular in Chinese AI circles like XHS and open-source communities) highlight several emerging patterns.

## Prominent Coordination Patterns

### 1. SOP-Driven (Standard Operating Procedure) Flow
*Pattern championed by MetaGPT and ChatDev.*
- **How it works:** Agents are assigned strict roles (e.g., Product Manager, Architect, Engineer, QA). The workflow follows a rigid, predefined waterfall or agile process.
- **Pros:** Highly predictable; reduces hallucinations by restricting the scope of each agent's input and output.
- **Cons:** Inflexible. If a task requires deviating from the SOP, the system often stalls.
- **Takeaway for our system:** Useful for well-defined pipelines (like `implement-and-review`), but not suitable for open-ended exploration.

### 2. Market-Based / Bidding Coordination
- **How it works:** A router or manager agent broadcasts a task. Available agents "bid" on the task based on their capabilities and current load.
- **Pros:** Decentralized and highly scalable. Easily allows adding new specialized agents without rewiring the whole system.
- **Cons:** Can introduce latency due to the negotiation phase.
- **Takeaway for our system:** Could be interesting for dispatching vague requests where multiple agents might have overlapping competencies.

### 3. Shared Blackboard / Memory System
- **How it works:** Instead of direct message passing (Agent A -> Agent B), agents read from and write to a shared "blackboard" or database.
- **Pros:** State is globally visible. Any agent can jump in when they see an opportunity to contribute.
- **Cons:** Requires strict schema enforcement on the blackboard to prevent data corruption or chaos.
- **Takeaway for our system:** We already use a form of this with the `.state/may.db` and the `sessions`/`metrics` tables. Reinforcing the rule that agents should react to state changes (event-driven) rather than waiting for direct invocation aligns perfectly with this pattern.

## Conclusion
For our internal architecture, the **Shared Blackboard** combined with **Event-Driven** triggers (heartbeats checking metrics) seems to be the most robust path forward, minimizing complex inter-agent API coupling while maintaining high observability.
