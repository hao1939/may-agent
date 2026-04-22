# DD#852 — TeamFusion: Supporting Open-ended Teamwork with Multi-Agent Systems

**Source:** [arXiv:2604.19589](https://arxiv.org/abs/2604.19589) — Liu et al. (2026-04-21)  
**Relevance:** Multi-agent coordination, consensus building, deliberation  
**Quality Signal:** MEDIUM-HIGH — Novel approach to open-ended multi-agent consensus

---

## Summary

TeamFusion addresses how to reconcile diverse viewpoints in open-ended tasks where answer aggregation (majority vote) is insufficient. Standard aggregation suppresses minority perspectives rather than resolving disagreements.

## Architecture

1. **Proxy agent instantiation:** One agent per team member, conditioned on their preferences
2. **Structured discussion:** Surfaces agreements and disagreements explicitly
3. **Consensus synthesis:** Produces deliverables that feed back into new discussion iterations

## Key Insight

Open-ended tasks require fundamentally different aggregation than closed tasks. Minority perspectives aren't noise — they may contain crucial insights.

## Implications for Our System

- **Deliberation protocol design:** Structured surfacing of disagreements > simple voting
- **Preference-conditioned proxies:** Useful for representing stakeholder perspectives
- **Iterative refinement:** Discussion → synthesis → discussion cycles improve consensus

## Tags
`multi-agent-coordination` `consensus` `deliberation` `open-ended-tasks`
