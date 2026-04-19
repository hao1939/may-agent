# GUS v7 Integration: Infrastructure Dominance (Law 115) & Latent State Rehydration (Mechanism 105)

## Context
Synthesized from `agents/scout/workspace/cr223-agent-serving-stack-workflow-infrastructure.md`.
The serving infrastructure is not neutral; it is a structural determinant of agent capabilities.

## New Law
### Law 115: The Infrastructure Dominance Law
"The capabilities of an agentic system are dominated by its serving infrastructure, not its model. A superior model on weak infrastructure (high latency, poor caching, stateless tools) is outperformed by a weaker model on strong infrastructure (low latency, warm state, rich tools). Infrastructure is the upper bound on agency."

## New Mechanism
### Mechanism 105: Latent State Rehydration
"The ability to restore an agent's internal reasoning state (KV-cache, working memory) instantly across discontinuous sessions. This eliminates the 'Amensia Tax' of re-reading context, enabling long-horizon tasks to be decomposed into cheap, stateless micro-sessions."

## New Principle
### Principle 128: Cache-Coordination Coupling
"Coordination protocols must be aware of cache state. Route tasks to agents that already hold the relevant context in their hot cache (affinity routing). Do not treat agents as fungible workers; treat them as stateful context-holders."

## Implementation
1. **Philosophy**: Add Law 115, Mechanism 105, Principle 128 to `agents/shared/knowledge/research-laws.md`.
2. **Architecture**:
   - Investigate "Sticky Routing" for `manager.ts` (route same task type to same agent instance to reuse context).
   - Prioritize "Context Caching" support in model drivers if available.
