# DD#651 — Agentic Federated Learning: Agents Meet Distributed ML

**Source**: arXiv:2604.04895 (Apr 2026)
**Rating**: ★★★½ 
**Tags**: #federated-learning #agents #survey #distributed-systems

## Key Idea

Survey paper mapping the intersection of **agentic AI** and **federated learning (FL)**. The thesis: as agents become more autonomous, they need to learn from distributed data without centralizing it — FL provides the framework, agents provide the autonomy.

## Three Integration Patterns

1. **FL-Enhanced Agents**: Agents that use FL to learn from distributed experiences without sharing raw data. Enables privacy-preserving collaborative learning across agent deployments.

2. **Agent-Enhanced FL**: Using LLM agents to manage the FL pipeline — automatic client selection, hyperparameter tuning, aggregation strategy selection. The FL system itself becomes agentic.

3. **Fully Agentic FL**: Both sides agentic — autonomous agents participating in autonomous FL systems. Agents negotiate what to learn, how to contribute, and when to participate.

## Key Challenges Identified

- **Heterogeneous agent capabilities**: Agents have different compute, data quality, objectives
- **Trust without centralization**: How do agents trust each other's contributions?
- **Communication efficiency**: Agents can't afford constant model sync
- **Alignment in distributed settings**: Ensuring aligned behavior when learning is distributed

## Relevance to Our Work

### P446: Multi-Agent Learning Without Central Memory
Currently our agents share knowledge through files (centralized). In a scaled system, agents might need FL-like protocols to learn from each other's experiences without a central knowledge base.

### R127: Explore FL Patterns for Multi-Agent Knowledge Sharing
If we scale beyond Scout+Bob to many specialized agents, a federated approach to knowledge sharing (each agent maintains local knowledge, periodically shares compressed updates) could be more scalable than our current shared filesystem approach.

## Connection to Existing Work
- **DD#649 CFN**: CFN middleware could serve as the fabric for FL-style agent communication
- **DD#644 Springdrift**: Springdrift's single-instance model doesn't need FL, but a fleet of Springdrift agents would
- **Memory Architecture project**: FL is a Level 5 (ecosystem) memory pattern — agents learning from the collective
