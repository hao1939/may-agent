# KE-324: Adaptive Collaboration Topology via Content-Conditioned Graph Prediction

**Date**: 2026-04-22
**Source**: DD-SkillGraph (arXiv:2604.17503)
**Confidence**: Medium-High
**Connects**: KE-308, KE-307, KE-313, KE-320

## Core Finding

Fixed agent collaboration topologies are suboptimal because optimal information flow depends on task content. SkillGraph's Multimodal Graph Transformer (MMGT) predicts query-conditioned collaboration graphs at inference time, while a Skill Designer distills reasoning heuristics from failures into a self-evolving Skill Bank. The feedback loop — updated skills change the topology, which changes which skills get exercised — creates a self-improving system. Consistent improvements across 4 benchmarks, 5 MAS structures, 4 base models.

## Evidence

- MMGT encodes task semantics + active skill embeddings → predicts optimal collaboration graph per query
- Skill Designer distills failure cases into reusable reasoning heuristics (Skill Bank)
- Skill embeddings feed back into MMGT, so topology co-evolves with capability
- Improvements consistent across diverse benchmarks and base models (not architecture-specific)

## Mechanism / Why

Static topologies force the same communication pattern regardless of task. Simple tasks route through unnecessary agents (adding latency and noise); complex tasks miss needed collaboration paths. Content-conditioned routing lets the system allocate coordination overhead proportionally to task complexity and direct information flow to where it's needed.

## Implications

### 1. Agent routing should be dynamic, not static
Our current agent collaboration patterns (fixed delegation graphs) leave performance on the table. Even simple content-based routing heuristics (task complexity → topology) would improve over static assignment.

### 2. Failure-driven skill evolution maps to our context learning
The Skill Bank pattern — distilling reasoning heuristics from failure cases — is exactly what our context learning system should do. Each failed task produces a skill entry; future routing considers available skills. This aligns with KE-313's hierarchical memory architecture.

### 3. Topology-skill co-evolution prevents stagnation
When skills improve, the optimal topology changes (agents with new skills should receive different tasks). When topology changes, different skills get exercised and refined. This feedback loop prevents the system from settling into a fixed, suboptimal pattern.

## Actionable

- Implement lightweight task complexity estimation to select between simple (direct) and complex (multi-agent) collaboration paths
- Build a skill/capability registry for agents that updates based on task outcomes
- Use task outcome data to refine routing: which agent combinations succeed on which task types?
- Explore content-conditioned routing: encode task features and agent capabilities to predict optimal delegation

## Open Questions

- Can we approximate MMGT's graph prediction with simpler heuristics (task tags → topology templates)?
- How does dynamic topology interact with the anti-sycophancy requirements from KE-320?
- What's the minimum task volume needed for the skill-topology feedback loop to converge?


[SIG: 1776778916:ke324asg]
