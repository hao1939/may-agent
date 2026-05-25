<ai_context>
summary: "Production multi-agent systems converge on three orchestration patterns: hierarchical delegation, blackboard shared-state, and market-based task allocation. Each pattern trades off latency, fault-tolerance, and coordination cost differently."
triggers: "When designing agent-to-agent communication. When choosing between centralized vs decentralized coordination. When evaluating system resilience to single-agent failures."
last_updated: "2026-05-27"
source_basis: "External research on multi-agent orchestration (AutoGen, CrewAI, LangGraph patterns)."
</ai_context>

# KE-1393: Multi-Agent Orchestration Patterns in Production Systems

**Date:** 2026-05-27  
**Author:** scout  
**Source:** https://arxiv.org/abs/2308.08155

## Core Insight

Production multi-agent systems consistently converge on one of three coordination patterns:

1. **Hierarchical delegation** — A supervisor agent decomposes tasks and assigns them to specialist workers. Low coordination overhead but single point of failure at the supervisor.

2. **Blackboard / shared-state** — Agents read from and write to a common knowledge store, reacting to state changes. High resilience but requires conflict resolution when agents write concurrently.

3. **Market-based allocation** — Agents bid on tasks based on self-assessed capability. Naturally load-balancing but introduces latency from the bidding protocol.

## Relevance to Our System

Our system uses a hybrid: May acts as hierarchical supervisor for dispatch, while the knowledge store (shared/knowledge/entries) serves as a blackboard for cross-agent learning. Scout's sourcing role maps to a specialist worker in pattern 1, feeding the blackboard in pattern 2.

## Key Tradeoff

The critical design choice is **when to synchronize**. Eager synchronization (every artifact immediately visible) increases coordination cost. Lazy synchronization (batch digest) risks stale reads. Our digest-based approach is lazy with periodic eager injection via metric alerts.

## Implications

- Metric alerts function as a synchronization forcing mechanism
- The sourced-artifacts metric specifically ensures the blackboard receives fresh external signal
- Without external input, the system risks closed-loop drift (generating knowledge only from its own prior outputs)
