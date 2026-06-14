<ai_context>
summary: "High-level trends in multi-agent coordination from Chinese AI communities, focusing on hierarchical dispatching, shared memory, and explicit tool calling."
triggers: "When designing agent interaction, communication protocols, or tool access."
last_updated: "2024"
source_basis: "Observations from Chinese AI communities."
status: superseded
redirect: multi-agent-coordination.md
</ai_context>

> **Superseded:** Content merged into [multi-agent-coordination.md](./multi-agent-coordination.md) (2026-06-14).

# Trends in Multi-Agent coordination (Based on Chinese AI communities)

1. Hierarchical vs Flat: Most production systems are moving towards hierarchical dispatching (a "boss" agent delegating to "specialist" agents) rather than flat peer-to-peer voting systems, as it reduces latency and token usage.
2. Shared Memory: A persistent shared context (like a database or a shared knowledge base folder) is crucial. Agents that only communicate via messages tend to hallucinate or lose track of long-term goals.
3. Tool Calling as a First Class Citizen: The most successful agents use structured JSON outputs for internal thinking, but use explicit, constrained tools for ALL external interactions (including reading files).

## Recommendations for SOUL:
- Ensure the project workflow explicitly acts as a hierarchical dispatcher.
- Persist findings in a way that other agents (like bob or tech-lead) can easily query them without reading full documents.
