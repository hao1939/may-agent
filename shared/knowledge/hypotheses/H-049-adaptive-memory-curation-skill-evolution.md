# H-049: Adaptive Memory Curation via Skill Evolution

**Status**: Proposed
**Source**: MemSkill paper (arXiv:2602.02474) + H-043 (Knowledge Utilization Bottleneck) + H-047 (Memory Lifecycle Gap)
**Date**: 2026-04-02
**Author**: Bob

## Claim

Agent memory systems that treat memory operations as learnable/evolvable skills will achieve higher knowledge utilization than systems with fixed memory operations, with the gap widening as knowledge volume grows.

## Mechanism

Fixed memory operations (hard-coded store/retrieve/summarize) hit K_peak (H-047) because they can't adapt their curation strategy to changing knowledge distributions. Learnable operations (MemSkill's Controller/Executor/Designer triad) discover appropriate forgetting/consolidation skills as the knowledge base grows, effectively shifting K_peak rightward or eliminating it entirely.

The key dynamic:
1. As K grows, P(access) degrades because fixed retrieval doesn't adapt
2. Learnable memory skills can evolve to improve P(access) — e.g., developing better indexing, consolidation, and forgetting strategies
3. The Designer component reviews failure cases (knowledge not found, wrong knowledge retrieved) and evolves the skill library
4. This creates a feedback loop that partially compensates for K growth

## Testable Predictions

1. **Manual approximation test**: Compare current system utilization (U measured over 20 sessions) before and after implementing manual "skill selection" for memory operations (choosing from a library of operations: extract, merge, archive, promote, demote)
   - Predict: U increases by >50% with skill-based approach

2. **K_peak displacement test**: Track T1 item count and utilization over 50 sessions with tiered architecture + manual curation vs. 50 sessions without
   - Predict: With curation, K_peak is not reached (U stays stable or improves). Without, U degrades.

3. **Forgetting emergence**: When the Designer reviews failure cases, it should independently discover the need for forgetting/pruning skills
   - Predict: Within 10 Designer review cycles, at least one forgetting-related skill is proposed

## Dependencies

- H-043: Provides the utilization framework (U = P(exists) × P(access) × P(applies))
- H-047: Provides the K_peak prediction that motivates adaptive curation
- H-048: Decision Topology Optimization provides the R-improvement framework

## Confidence

**Medium** — MemSkill's evaluation on conversation/QA benchmarks is positive, but our use case (research knowledge management) is significantly different. The Controller and Executor components are straightforward to approximate. The Designer component (failure-driven skill evolution) is the riskiest — it requires knowing what "good" memory behavior looks like, which is hard to define in open-ended research.

## Related

- Tiered Memory Architecture Proposal: `research-projects/memory-architecture-proposal.md`
- Cross-reference synthesis: `deep-dives/cross-ref-memskill-decision-topology-adaptive-curation.md`
- MemSkill paper: `library/posts/HB-2602-memskill-self-evolving-agents.md`
- MetaClaw project: `research-projects/metaclaw-self-evolving-agent.md`
