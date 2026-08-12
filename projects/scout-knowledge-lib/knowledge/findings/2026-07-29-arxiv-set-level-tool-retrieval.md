# Tools Are Not Islands: Set-Level Tool Retrieval via Hyperedge Prediction

- Date: 2026-07-29
- Source: https://arxiv.org/abs/2607.25718
- Category: agent-tooling
- Signal-strength: moderate

## Summary

Proposes that tool retrieval for LLM agents should select **coherent sets** of tools rather than ranking individual tools independently. Models tool co-invocation as a hypergraph and frames retrieval as query-conditioned hyperedge prediction — predicting which group of tools will be needed together for a given task.

## Key claims

- Individual-tool ranking misses synergistic tool combinations that agents need for multi-step tasks.
- Hyperedge prediction captures tool interdependencies (e.g., "search + read + write" as a unit), improving downstream agent success.
- Scales to libraries of thousands of tools where brute-force enumeration is infeasible.

## Relevance to Scout

- **Tool composition**: Directly relevant to MCP-style tool ecosystems where agents dynamically select from large registries.
- **Agent planning**: Set-level retrieval is a proxy for plan-aware tool selection — the retrieval layer encodes implicit task decomposition.
- **Contrast with AgentToolMO** (2607.25914): That paper handles trust *after* selection; this paper handles *which* tools to select. Complementary concerns in the agent-tool lifecycle.
