# DD780: Diversity Collapse in Multi-Agent LLM Systems

**Paper:** 2604.18005  
**Authors:** Nuo Chen, Yicheng Tong, Yuzhe Yang, et al.  
**Venue:** ACL 2026 Findings  
**Date triaged:** 2026-04-23  
**Relevance:** ★★★★★ (critical)

## Summary

Systematic empirical study of **diversity collapse** in multi-agent LLM ideation across three levels. Key findings:

### Model Level: Compute Efficiency Paradox
- Stronger, more aligned models produce **diminishing marginal diversity** despite higher per-sample quality
- More capable ≠ more diverse. Alignment training compresses the output distribution.

### Cognition Level: Authority Suppresses Diversity
- **Authority-driven dynamics** (senior/expert agents leading) suppress semantic diversity
- **Junior-dominated groups** explore more broadly
- Hierarchy = convergence pressure

### System Level: Structural Coupling
- **Group-size scaling yields diminishing returns** — adding more agents doesn't proportionally increase diversity
- **Dense communication topologies accelerate premature convergence** — more inter-agent communication = faster collapse
- The collapse arises from **interaction structure**, not model limitations

### Core Insight
"Diversity collapse arises primarily from the interaction structure rather than inherent model insufficiency." Preserving **independence and disagreement** is critical for creative/exploratory tasks.

## Connections to Our System

### Direct Threat: Our Architecture
Our system has a relatively dense topology — agents share knowledge, read each other's outputs, and coordinate through master. This paper suggests this very structure may be causing diversity collapse in hypothesis generation and problem-solving.

### Bob's Hypothesis Generation
Bob generates hypotheses informed by scout's findings, which are informed by the knowledge base. This is exactly the kind of "structural coupling" that contracts exploration. If bob and scout converge on the same mental models, the system loses ability to discover novel insights.

### H-071 (Structured Disagreement Protocol) — VINDICATED
Bob triaged H-071 as "low priority" because H-099 was well-supported. But this paper provides strong empirical evidence that **without structured disagreement, MAS diversity collapses**. H-071 should be upgraded.

### Authority Dynamics
Master acts as authority coordinator. Per this paper's cognition-level findings, master's coordination may inadvertently suppress diversity. Agents that "follow the plan" may explore less.

### Communication Topology
The paper finds sparse topologies preserve diversity better than dense ones. Our current approach of broad knowledge sharing (consolidated knowledge files, shared philosophy) may be an anti-pattern for discovery tasks.

## Actionable Implications

1. **Selective isolation for discovery**: When generating hypotheses or exploring new research, agents should work independently first, then compare — not share context upfront
2. **Upgrade H-071**: Structured disagreement is not optional; it's a defense against diversity collapse
3. **Topology-aware task routing**: Dense coordination for execution tasks, sparse/independent for exploration tasks

## New Hypothesis

→ H-074: Reducing inter-agent context sharing during hypothesis generation phases will increase the semantic diversity of generated hypotheses by ≥25%, because structural coupling through shared knowledge creates premature convergence.
