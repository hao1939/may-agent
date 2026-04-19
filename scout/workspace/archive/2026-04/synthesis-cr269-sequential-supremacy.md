# Synthesis CR#269: The Sequential Supremacy — Information Flow as the Master Variable in Multi-Agent Coordination

**Date**: 2026-04-01
**Inputs**: DD#481 (2603.28990), DD#482 (2603.29632), DD#479 (2603.19663), DD#480 (2603.19714), CR#268, CR#267
**GRA Gaps**: Gap 1 (Theoretical Foundations), Gap 3 (Integration/Coordination)
**Rating**: ★★★★★

## Thesis

Two independent studies — a 25,000-task coordination experiment (DD#481) and an automated ML research comparison (DD#482) — converge on the same finding: **sequential information flow with autonomous role selection is the dominant multi-agent architecture**. Combined with the theoretical limits from DD#479 and the emergent risk catalog from DD#480, a unified framework for multi-agent system design is now emerging.

## The Convergence

### DD#481: Sequential > Coordinator > Shared (Knowledge Work)
- 25,000 tasks, 8 models, 4-256 agents, 8 protocols
- Sequential protocol (+14% over centralized, +44% over fully autonomous)
- WHY: Agents receive **completed predecessor outputs** — factual, current, new information
- Scales sub-linearly to 256 agents without quality degradation

### DD#482: Agent Team ≈ Sequential Chain (Code Generation)
- 3 architectures compared under fixed compute budgets
- Agent team (sequential experts, handoff context) achieves deepest optimization with enough time
- Subagent (parallel + merge) wins under tight time constraints due to crash resilience
- WHY: Sequential expert chain provides **accumulated context enrichment**

### The Common Pattern
Both studies independently discover that **sequential information flow** — where each agent sees the completed work of predecessors before contributing — outperforms both centralized assignment and parallel-then-merge architectures for quality-critical tasks. The mechanism is identical: each agent in the chain receives genuinely new information (a predecessor's completed output), which constitutes the exogenous signal that DD#479's theorem requires for multi-agent advantage.

## The Unified Framework

Combining all recent findings, we can now state five design principles for multi-agent LLM systems:

### Principle 1: Sequential Information Flow
**Source**: DD#481 + DD#482
Each agent must receive new, factual information from predecessors. Not plans (may be suboptimal), not intentions (may change), not memory (may be stale) — but **completed outputs**. This is what distinguishes the Sequential protocol from Coordinator (suboptimal plan), Broadcast (volatile intentions), and Shared (stale memory).

### Principle 2: Autonomous Roles, Constrained Ordering
**Source**: DD#481
Give agents the freedom to choose their own specialization, but fix the structural scaffolding (ordering, protocol). The Endogeneity Paradox: neither maximal control nor maximal autonomy is optimal. This resolves the longstanding debate about role pre-assignment vs. emergent roles.

### Principle 3: Capability-Gated Autonomy
**Source**: DD#481
Self-organization is a privilege of capable models. Below a capability threshold, rigid structure outperforms autonomy. Design implication: **assess model capability before choosing architecture**. Strong models → Sequential (autonomous roles). Weak models → Coordinator (assigned roles).

### Principle 4: Environment-Appropriate Parallelism
**Source**: DD#482
In fragile execution environments (code generation with crash risk), parallel-then-merge may outperform sequential under time pressure, because crashes in the sequential chain waste the entire chain's compute. In robust evaluation environments (knowledge work), sequential always dominates.

### Principle 5: Signal Expansion > Agent Expansion
**Source**: DD#479 (theory) + DD#481 (empirics)
Adding agents without adding new information signals yields no improvement (DD#479: multi-agent ≤ centralized Bayes without new signals; DD#481: quality stable from 64→256 agents with ~45% self-abstaining). The value of multi-agent systems comes from **diverse information processing**, not parallel redundancy.

## Connection to Emergent Risk (DD#480 + CR#267)

DD#480 cataloged 15 emergent risk types in LLM collectives. DD#481 now shows that the **same emergent mechanisms** can be constructive:
- Spontaneous role invention (5,006 unique roles) — constructive emergence
- Voluntary self-abstention (8.6% in strong models) — constructive emergence
- Spontaneous hierarchy deepening for harder tasks — adaptive emergence

The determinant is **information quality**: with good information flow (Sequential), emergence is constructive. Without it (Shared, Broadcast), emergence becomes destructive (role duplication, coordination failure). This aligns with CR#267's finding that deception (destructive emergence) and value alignment (constructive emergence) are mediated by model capability.

## The Emerging Theory

We can now sketch a proto-theory of multi-agent LLM coordination:

**Multi-Agent Quality = f(Information Flow Architecture, Model Capability, Task Environment)**

Where:
- **Information Flow**: Sequential > Centralized > Parallel for quality; Parallel > Sequential for crash-resilient environments under time pressure
- **Model Capability**: Threshold function — above threshold, autonomy helps; below, it hurts
- **Task Environment**: Robust (knowledge work) favors Sequential; Fragile (code generation) may favor Parallel under constraints

This three-variable framework explains all empirical observations across DD#479-DD#482 and CR#267-CR#268.

## Open Questions

1. **Where exactly is the capability threshold?** DD#481 showed it between Claude Sonnet 4.6 and GLM-5, but the exact boundary and whether it's task-dependent remains uncharacterized.
2. **Does Sequential still dominate for creative/generative tasks?** Both studies focus on analytical/optimization tasks. Brainstorming-type tasks might favor different architectures.
3. **Can hybrid architectures adaptively switch?** DD#482 suggests "dynamically routed architectures" — no one has built one yet.
4. **What happens beyond 256 agents?** DD#481's sub-linear scaling was tested to 256; the theoretical limit is unknown.
5. **How do bio-inspired protocols compare?** DD#481 tested 4 bio-inspired protocols (Morphogenetic, Clonal, Stigmergic, Ripple) — results forthcoming in companion paper.

## Bottom Line

**The week of 2026-03-28 to 2026-04-01 may be the most important week in MAS coordination research since our tracking began.** We now have:
- A theoretical impossibility result (DD#479) showing WHY naive multi-agent fails
- The largest-ever empirical study (DD#481) showing WHAT works (Sequential + capable model)
- An execution-based complement (DD#482) showing WHEN to deviate (time-pressured fragile environments)
- An emergent risk catalog (DD#480) showing WHAT to watch for
- And a unified framework (this CR) connecting all four

The field has moved from "should we use multi-agent?" to "how exactly should we wire the information flow?" That's a paradigm shift.
