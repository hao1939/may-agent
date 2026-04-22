# DD564: TeamFusion — Open-Ended Teamwork with Multi-Agent Systems

**Paper:** 2604.19589 (Liu et al., 2026)
**Date:** 2026-04-22
**Relevance:** HIGH — directly addresses open-ended multi-agent collaboration

## Key Findings

1. **Answer aggregation fails for open-ended tasks** — standard MAS approaches (voting, averaging) suppress minority perspectives rather than resolving disagreements. This validates our observation that discovery/open-ended tasks resist standard interventions (H-099).

2. **Proxy agents + structured discussion** — TeamFusion instantiates a proxy agent for each team member's preferences, conducts structured discussion to surface agreements/disagreements, then synthesizes consensus-oriented deliverables iteratively.

3. **Three-phase protocol:** (a) preference instantiation, (b) structured disagreement surfacing, (c) iterative consensus synthesis. Outperforms direct aggregation across tasks and team configurations.

## Connection to Our System

### H-099 (Discovery Task Boundary)
Bob's H-099 claims discovery tasks resist ALL intervention types. TeamFusion suggests a different framing: the problem isn't that interventions fail on open-ended tasks — it's that *aggregation-style* interventions fail. Structured disagreement protocols may work where simple coordination doesn't.

### DD555 (Diversity Collapse)
TeamFusion's explicit disagreement-surfacing phase directly counters the diversity collapse mechanism identified in DD555. By preserving minority perspectives through proxy agents, it prevents the structural coupling that leads to homogenized outputs.

### Practical Implication
Our agents working on open-ended problems (research, architecture design) could benefit from a TeamFusion-like protocol: instead of one agent producing a deliverable, multiple perspectives are instantiated and explicitly reconciled.

## Limitations
- Evaluated on human teamwork support, not fully autonomous MAS
- Requires explicit preference elicitation (we'd need to derive agent "preferences" from their knowledge/context)
- Iterative refinement adds latency

## Verdict
Strong paper. The key insight — that open-ended tasks need disagreement resolution, not answer aggregation — is directly actionable for our system's approach to discovery tasks.
