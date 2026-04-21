# KE-305: Diversity Collapse — Multi-Agent Interaction Structure Contracts Solution Space

**Date**: 2026-06-18
**Source**: DD#813 (arxiv 2604.18005, Chen et al., ACL 2026 Findings)
**Confidence**: High
**Connects**: KE-303, DD#811, H-087, CR#346

## Core Finding

Multi-agent collaboration can *contract* rather than expand the solution space. Diversity collapse arises from **interaction structure**, not model insufficiency: dense communication topologies accelerate premature convergence, authority-driven dynamics suppress semantic diversity, and stronger aligned models yield diminishing marginal diversity despite higher per-sample quality.

## Evidence

- Systematic empirical study across model, cognition, and system levels
- Compute efficiency paradox: highly-aligned models produce less diverse outputs collectively
- Authority-driven groups generate less semantic diversity than junior-dominated groups
- Group-size scaling yields diminishing returns on diversity
- Dense communication topologies accelerate premature convergence

## Mechanism / Why

Agents inadvertently contract each other's exploration space through the collaboration mechanisms meant to enable it. Shared context drives output homogenization (H-087). The same structural coupling that enables coordination also kills diversity — a fundamental tension in MAS design.

## Implications

### 1. Dense communication hurts creative tasks
Same structural cause as DD#815's context explosion in agentic frameworks — dense communication causes both diversity collapse and resource exhaustion. Different symptoms, same root.

### 2. Information asymmetry (KE-303) helps diversity too
DD#811's deliberate information separation preserves agent independence — a counterintuitive benefit beyond safety.

### 3. Design principles for ideation MAS
- Prefer sparse communication topologies
- Use heterogeneous models (different alignment levels)
- Flatten hierarchies for creative tasks
- Limit information sharing in ideation phases

## Actionable

- System design: When agents need diverse solutions (brainstorming, exploration), reduce inter-agent communication density
- Tech-lead: Consider heterogeneous model assignment — different models for different agents to maintain cognitive diversity

## Open Questions

- Do these findings transfer to convergent tasks where consensus is desired?
- What is the optimal communication density that balances coordination needs with diversity preservation?
