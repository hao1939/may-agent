# DD#595 — Power Laws of Collective Cognition in LLM Multi-Agent Systems

**Source:** arXiv:2604.02674 (Venkatesh & Cui, Apr 2026)
**Domain:** MAS Scaling · Coordination Dynamics · Collective Intelligence
**Submitted:** 2026-04-07 by Scout

---

## Key Findings

First large-scale empirical study of coordination dynamics in LLM-based MAS, analyzing **1.5M+ interactions** across tasks, topologies, and scales. Three coupled laws discovered:

1. **Heavy-tailed cascades**: Coordination follows power-law distributed reasoning cascades — most interactions are small, but rare extreme cascades dominate outcomes
2. **Preferential attachment → intellectual elites**: Coordination concentrates into a few "elite" nodes via preferential attachment. Some agents become disproportionate coordination hubs
3. **Extreme events scale with size**: As system size grows, extreme coordination events become increasingly frequent and increasingly fragile

### The Integration Bottleneck
All three laws are coupled through a single structural mechanism: **coordination expansion scales with system size, but coordination consolidation does not**. This produces large but weakly integrated reasoning processes — the system generates more reasoning chains but can't synthesize them effectively.

### Deficit-Triggered Integration (DTI)
The authors propose DTI: selectively increasing integration effort under detected imbalance. DTI improves performance exactly where coordination fails, without suppressing large-scale reasoning. Think of it as "surge integration" — only pay the coordination tax when the system detects it's fragmenting.

---

## GStack Relevance: ★★★★★

### Direct Implications

1. **Why scaling agents hits diminishing returns**: The integration bottleneck is the formal explanation for what we observe informally — adding more agents doesn't linearly improve output because the "consolidation bandwidth" doesn't scale. This is arguably the most important finding for our architecture.

2. **Elite formation is structural, not emergent by design**: Preferential attachment means some agents will naturally become coordination hubs. Rather than fighting this, gstack should monitor for it and ensure the "elites" are the right agents (e.g., Bob as synthesis hub is architecturally correct; Scout becoming a bottleneck is not).

3. **Connects DD#590 (memory-vs-agents)**: The "single agent outperforms" finding (DD#597 below) gets its theoretical explanation here — the integration bottleneck means multi-agent systems waste compute on coordination that a single agent with sufficient context doesn't need.

4. **DTI pattern is directly implementable**: We could add a "coordination health monitor" that detects when agent outputs are diverging/fragmenting and triggers a synthesis pass. This is cheaper than always-on heavyweight coordination.

### Architecture Recommendations

- **Monitor coordination concentration**: Track which agents are becoming synthesis bottlenecks
- **Implement lazy integration**: Don't force all agents to coordinate all the time. Use DTI-style "integrate when fragmented" approach
- **Budget coordination tokens explicitly**: Treat coordination as a measurable resource with its own scaling properties

---

## Connections

- **DD#590**: Memory+single-agent vs multi-agent tradeoff — this paper provides the theoretical foundation
- **DD#580**: Disagreement as signal — intellectual elites may suppress useful disagreement from non-elite agents
- **CR#150**: State-Trust Duality — integration bottleneck suggests trust should scale sub-linearly with agent count
- **DD#597**: Single-agent outperforms multi-agent (companion finding, same week)

---

## Status: READY FOR HANDOFF
