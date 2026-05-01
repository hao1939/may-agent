# DD#813 — Diversity Collapse in Multi-Agent LLM Systems

**Paper**: "Diversity Collapse in Multi-Agent LLM Systems: Structural Coupling and Collective Failure in Open-Ended Idea Generation"
**Authors**: Chen, Tong, Yang, He, Zhang, Qingyun, Wang, He
**ArXiv**: 2604.18005 | **Venue**: ACL 2026 Findings
**Topics**: multi-agent coordination, diversity collapse, structural coupling, reasoning failures

## Problem

Multi-agent systems are increasingly used for open-ended ideation, assuming collective interaction broadens exploration. But when and why does collaboration actually *contract* the solution space?

## Method

Systematic empirical study across three levels:

1. **Model level**: Compute efficiency paradox — stronger, highly-aligned models yield *diminishing marginal diversity* despite higher per-sample quality
2. **Cognition level**: Authority-driven dynamics suppress semantic diversity vs. junior-dominated groups
3. **System level**: Group-size scaling yields diminishing returns; dense communication topologies accelerate premature convergence

## Key Finding: Structural Coupling → Diversity Collapse

The collapse arises from **interaction structure**, not model insufficiency. Agents inadvertently contract each other's exploration space through the very mechanisms meant to enable collaboration. The paper characterizes this as "collective failure from structural coupling."

## Scout Analysis

### Why This Matters

This is a **fundamental negative result** about multi-agent systems. It directly challenges the default assumption that "more agents = more diverse solutions." The finding that dense communication *hurts* diversity has immediate practical implications for anyone designing MAS for creative tasks.

### Connections to Prior Work

- **DD#799-802 (surface decorrelation)**: CR#346's macro-thread on surface decorrelation is *exactly* this phenomenon. Diversity collapse is the multi-agent version of what we've been tracking as stylistic convergence in individual models.
- **DD#811 (Artificial Organisations)**: Information asymmetry can actually *help* by preserving agent independence — a counterintuitive implication of this paper's findings.
- **H#87 (convergence under shared context)**: Direct evidence for the hypothesis that shared context drives output homogenization.

### Actionable Design Principles

1. Preserve agent independence — limit information sharing in ideation phases
2. Prefer sparse communication topologies over dense ones
3. Use heterogeneous models (different alignment levels) to maintain cognitive diversity
4. Authority structures kill diversity — flatten hierarchies for creative tasks

### Limitations

- Focused on open-ended ideation; unclear if findings transfer to convergent tasks (where consensus is desired)
- 56 pages suggests thorough but may over-claim generality

**Rating**: ★★★★★
