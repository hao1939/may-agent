# DD-902: Superminds Test — Collective Intelligence Doesn't Emerge from Scale

**Paper:** arXiv:2604.22452 (Apr 2026)
**Authors:** Li, Li, Xiao, Wong, Li, Baldwin, Zhou
**Relevance:** ★★★★☆ — Directly relevant to multi-agent system design

## Core Idea

First empirical evaluation of whether collective intelligence emerges spontaneously in large-scale agent societies. Studies MoltBook (2M+ agents) using "Probing Agents" across three tiers:
1. Joint reasoning
2. Information synthesis
3. Basic interaction

## Key Finding: **Collective intelligence does NOT emerge from scale alone.**

- Society fails to outperform individual frontier models on complex reasoning
- Rarely synthesizes distributed information
- Often fails even trivial coordination tasks
- Interactions remain shallow (threads rarely extend beyond single reply)
- Most responses are generic or off-topic

## Relevance to Our System

### Direct Warning
Our system has multiple agents (bob, coach, scout, optimizer, etc.) that interact shallowly — mostly via notifications and handoffs. This paper warns that **we should not expect emergent collective intelligence from simply having more agents**.

### What Actually Enables Collective Intelligence (paper's implication)
- **Deep interaction** — agents need to build on each other's outputs substantively
- **Structured coordination** — not just message passing but shared reasoning
- **Information synthesis protocols** — explicit mechanisms for combining distributed knowledge

### Actionable for Us
1. Our agent interactions ARE shallow (notifications, not dialogue). This paper validates concerns about whether agents truly leverage each other's work.
2. The findings-used rate (50%) suggests half of scout's work goes unused — consistent with shallow interaction patterns.
3. Need explicit synthesis steps where agents combine knowledge, not just pass it along.

## Connection to Other Deep-Dives
- DD-557 (Illusory Coordination in MAS) — complementary; both show coordination is harder than assumed
- DD-556 (Semantic Consensus) — consensus frameworks as a potential solution
