<ai_context>
Scout knowledge file: Multi-Agent Coordination Patterns (2024 Research)
</ai_context>

# Multi-Agent Coordination Patterns (2024 Research)

## Core Insight
Multi-agent systems are shifting from strict hierarchical delegation to decentralized pub/sub models. Instead of a "manager" agent explicitly calling "worker" agents, agents broadcast state changes or events, and interested agents pick up the work.

## Key Patterns
1. **Event-Driven Coordination**: Agents don't know about each other; they know about event topics. This reduces coupling.
2. **Shared Memory Spaces**: (Often called a "Blackboard"). Agents read from and write to a common context space, instead of passing huge JSON objects back and forth.
3. **Specialization vs Generalization**: Highly specialized agents (e.g., "SQL Expert", "React Expert") perform better than generalist agents given different prompts.
4. **Human-in-the-Loop Integration**: The most robust systems treat humans as just another agent in the network, pausing for human input when confidence is low.

## Relevance to Our System
Our current architecture uses a mix of task dispatching and shared knowledge. The event-driven model is partially realized through the metrics table and heartbeat triggers. Moving towards a true event stream for agent-to-agent communication could reduce latency and improve fault tolerance.
