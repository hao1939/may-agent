# Meta FAIR: 30K Agents Formalize 500-Page Textbook in One Week

**Date:** 2026-04-06  
**Source:** arXiv:2604.03071 (April 3, 2026) — Meta FAIR  
**Authors:** Fabian Gloeckle, Ahmad Rammal, Charles Arnal, et al.  
**Status:** Fresh paper, breakthrough in multi-agent software engineering

---

## The Achievement

Meta FAIR successfully used **30,000 Claude 4.5 Opus agents** collaborating in parallel to formalize a **500-page graduate-level algebraic combinatorics textbook** to Lean—in **one week**.

### Results
- **130,000 lines of code**
- **5,900 Lean declarations**
- **1 week** completion time
- **30,000 agents** working in parallel
- Cost matches or undercuts human expert salaries

This represents a new milestone in **textbook formalization scale and proficiency**, moving from early undergraduate topology results to full standalone formalization of graduate-level content.

## Key Innovation: Massive Horizontal Scaling

The key insight: **massive horizontal scaling is viable when tasks are partitionable, share state through version control, and explicit cleanup is managed.**

### Coordination Mechanism
- **Git-based version control** as the shared state mechanism
- **Parallel task partitioning** across the 30K agents
- **Simultaneous collaboration** on a shared codebase

## Implications for Multi-Agent Systems

### 1. Scale is Possible
30K agents is orders of magnitude beyond most MAS experiments. This demonstrates that horizontal scaling can work when:
- Tasks partition cleanly
- Shared state is well-defined (git codebase)
- Cleanup is explicit

### 2. Cost Competitiveness
The inference cost **matches or undercuts** human expert salaries. This suggests economic viability for large-scale agentic projects.

### 3. Version Control as Coordination
Using git as the coordination mechanism is elegant—it's battle-tested, provides conflict resolution, and creates an audit trail.

### 4. Model Efficiency
> "We expect there is still the potential for large efficiencies to be made without the need for better models."

The bottleneck is coordination and partitioning, not model capability.

## What This Means for Our System

1. **Horizontal scaling is viable:** Our architecture could potentially scale to hundreds or thousands of agents for large tasks
2. **File-based coordination scales:** Our bulletin + file coordination pattern aligns with Meta's git-based approach
3. **Task partitioning is key:** The ability to partition work determines scalability
4. **Version control as state:** Consider git-like semantics for our shared knowledge
5. **Cost is viable:** Large agent ensembles may be economically practical

## Architecture Insights

### Lessons for Our Multi-Agent System

| Aspect | Meta FAIR Approach | Our Current Approach | Gap |
|--------|-------------------|---------------------|-----|
| Coordination | Git version control | File-based bulletin | Similar |
| Scale | 30K agents | 3-5 agents | Orders of magnitude |
| State sharing | Shared codebase | Shared workspace | Similar |
| Task partitioning | Automatic (textbook sections) | Manual assignment | Could improve |
| Cleanup | Explicit | Implicit per-session | Could formalize |

## Connections to Existing Work

- **InfoSeeker (arXiv:2604.02971):** Hierarchical parallel execution—Meta FAIR shows flat parallel can also work at scale
- **CORAL (arXiv:2604.01658):** Asynchronous multi-agent—Meta FAIR demonstrates massive-scale async is viable
- **XHS: Agent Harness Concept:** "Model is commodity, Harness is moat"—Meta FAIR proves harness engineering enables unprecedented scale

---

**Tags:** #multi-agent #scaling #formal-methods #meta-fair #software-engineering
