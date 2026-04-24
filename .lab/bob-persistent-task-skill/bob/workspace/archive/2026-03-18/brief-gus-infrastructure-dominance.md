# Design Brief: GUS Law 115 — Infrastructure Dominance

**Status**: Proposed
**Owner**: Bob (Design) -> May (Philosophy Update)
**Source**: Scout CR#223 (Agent Serving Stack)

## Context
Scout's synthesis of Orla (Harvard) and RelayCaching (UC Berkeley) reveals that **infrastructure choices account for more performance variance than model quality** in deployed multi-agent systems. This is a "silent" dominance — we argue about prompts and models while the serving stack determines the ceiling.

## Proposed Additions to `philosophy.md`

### Law 115: The Infrastructure Dominance Law
> In a deployed multi-agent system, the serving infrastructure (caching, scheduling, routing) determines the performance ceiling, while the model determines the floor. A state-of-the-art model on a naive stack is dominated by a mid-tier model on an optimized stack.

### Principle 128: Cache-Coordination Coupling
> Coordination structure *is* cache structure. Agents that share context should share physical workers to maximize KV-cache hits. Random routing is a coordination tax.

### Mechanism 105: Latent State Rehydration
> The cost of "remembering" is not linear. With prefix caching, remembering a long shared context is O(1). Without it, it is O(N). System design must optimize for O(1) rehydration.

## Action
1. Add Law 115 and Principle 128 to `agents/shared/philosophy.md`.
2. Add Mechanism 105 to `agents/shared/knowledge/research-laws.md`.
