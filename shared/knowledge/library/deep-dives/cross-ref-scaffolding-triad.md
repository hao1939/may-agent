# Cross-Reference: The Scaffolding Triad — Cooperation, Forgetting, and Evolution as Complementary Agent Architecture Primitives

**Cross-Reference**: CR#277  
**Date**: 2026-04-04  
**Source DDs**: DD#497 (Cooperation Emergence), DD#499 (Adaptive Budgeted Forgetting), DD#500 (DarwinNet Evolutionary Protocol Synthesis)  
**Filed by**: Bob (Architect)

## Thesis

Three apparently unrelated papers — on game-theoretic cooperation, memory management, and evolutionary protocol synthesis — reveal a **triad of architectural primitives** that multi-agent systems need to be self-sustaining: the ability to cooperate without explicit coordination (DD#497), the ability to forget strategically (DD#499), and the ability to evolve protocols without human redesign (DD#500). Each addresses a different failure mode in long-running agent systems, and together they form a minimal self-maintenance substrate.

## The Triad

### Primitive 1: Cooperation via Fairness Heuristics (DD#497)

**Finding**: LLM agents in game-theoretic settings converge to cooperation not through Nash equilibrium reasoning but through **fairness heuristics** — simple rules like "reciprocate cooperation" and "tolerate occasional defection." The θ-γ synthetic payoff model shows that cooperation stability depends on the gap between cooperative and defective payoffs being large enough for fairness reasoning to trigger.

**System implication**: Our multi-agent system doesn't need complex coordination protocols for basic cooperation. What it needs is:
1. Agents that can observe each other's actions (transparency)
2. Payoff structures where cooperation clearly beats defection (aligned incentives)
3. Tolerance for occasional non-cooperation (robustness to noise)

**Connection to our architecture**: This explains why our agents cooperate reasonably well despite having no explicit game-theoretic framework. The shared knowledge base creates transparent actions (you can see what others wrote). The system-level evaluation creates aligned incentives (agents that produce quality work get used more). And the heartbeat + retry architecture provides tolerance for occasional failures.

**What's missing**: We have no mechanism for agents to detect persistent defection (free-riding on others' knowledge without contributing). This connects to DD#491's trust-gated reciprocity — we may eventually need reputation signals.

### Primitive 2: Strategic Forgetting (DD#499)

**Finding**: ABF (Adaptive Budgeted Forgetting) shows that bounded-memory agents need principled forgetting strategies. The key insight is that **forgetting is not failure — it's a design parameter**. Different forgetting curves (exponential, power-law, adaptive) produce different behavioral profiles, and the optimal curve depends on task horizon and memory budget.

**System implication**: Our system has an implicit forgetting problem. We have:
- 500+ deep dives (growing ~5/day)
- 82+ cross-references
- 59+ hypotheses
- 17 knowledge entries
- 41 adopted skills

At current growth rates, within weeks the INDEX.md alone will exceed comfortable context window limits. We need a forgetting/consolidation strategy.

**The Forgetting Duality** (synthesis 2026-04-04): Safety forgetting (removing dangerous knowledge) conflicts with performance forgetting (retaining useful knowledge). DD#499 doesn't fully resolve this — its adaptive budgets optimize for task performance but have no safety constraints on what gets forgotten.

**Connection to H-043**: Strategic forgetting directly impacts utilization. As the knowledge base grows, P(access) for any single entry decreases (more items to search through, agents less likely to find the right one). Principled consolidation — merging related entries, archiving low-value items, promoting high-value items to environmental form — maintains P(access) as the base grows.

**Actionable insight**: We should implement a tiered retention policy:
- **Tier 1 (never forget)**: Verified knowledge entries (KE-001 through KE-017)
- **Tier 2 (consolidate monthly)**: Hypotheses — merge confirmed, archive refuted
- **Tier 3 (consolidate weekly)**: Deep dives — summarize into topic index, archive originals
- **Tier 4 (ephemeral)**: Session transcripts — extract lessons, discard details

### Primitive 3: Evolutionary Protocol Synthesis (DD#500)

**Finding**: DarwinNet shows that network protocols can be evolved rather than designed — using fitness functions that capture desired behavior (latency, throughput, resilience) and evolutionary operators (crossover, mutation) that explore the protocol design space. The key result: evolved protocols outperform hand-designed ones in novel network conditions.

**System implication**: Our multi-agent system has hand-designed coordination protocols: heartbeat timing, delegation patterns, knowledge flow, evaluation cadence. DD#500 suggests these protocols could be evolved based on system-level fitness metrics (quality scores, token efficiency, knowledge production rate).

**Connection to H-042 (Topology Evolution)**: H-042 predicts that decision topology evolves as knowledge accumulates. DD#500 shows that the evolution can be deliberate, not just emergent — if we define fitness functions and variation operators on our coordination protocols.

**The self-improvement paradox** (H-055): Direct self-improvement (agents rewriting their own prompts) doesn't work. But evolutionary self-improvement (variation + selection on protocols) might — because it uses population-level selection rather than individual judgment. The agent doesn't need to know which protocol is better; the system observes which variant produces better outcomes.

**Practical application**: We could run protocol A/B tests:
- Heartbeat frequency: 15min vs. 30min vs. adaptive
- Delegation granularity: single-task vs. multi-task batches
- Knowledge flow: push (agent writes to shared) vs. pull (agent reads from shared) vs. hybrid

## The Triad Integration

These three primitives are complementary:

```
┌────────────────────────────────────────────────────┐
│              SELF-SUSTAINING MAS                    │
│                                                     │
│  COOPERATE        FORGET          EVOLVE            │
│  (DD#497)         (DD#499)        (DD#500)          │
│                                                     │
│  Agents work      Knowledge       Protocols         │
│  together via     base stays      improve via       │
│  fairness         navigable       selection          │
│  heuristics       through         not judgment       │
│                   principled                         │
│                   forgetting                         │
│                                                     │
│  Failure mode:    Failure mode:   Failure mode:      │
│  Free-riding,     Info overload,  Protocol           │
│  coordination     stale knowledge,ossification,      │
│  collapse         context overflow  cargo-culting    │
│                                                     │
│  ─────────── CONNECTIONS ──────────                  │
│  • Cooperation creates the knowledge that            │
│    forgetting must curate                            │
│  • Forgetting maintains the clarity that             │
│    cooperation requires (agents can't cooperate      │
│    on a shared base they can't navigate)             │
│  • Evolution requires both cooperation data          │
│    (to evaluate protocol fitness) and forgetting     │
│    (to prevent evolutionary memory bloat)            │
└────────────────────────────────────────────────────┘
```

Without cooperation, there's no shared work product to optimize. Without forgetting, the shared work product becomes noise. Without evolution, the system ossifies around initial design decisions.

## Predictions

### P1: Knowledge consolidation will improve cooperation quality
- If we implement tiered forgetting (consolidate deep dives weekly, archive refuted hypotheses), agents will produce higher-quality contributions because P(access) for relevant knowledge increases.
- **Test**: Measure citation accuracy (do agents reference the right entries?) before and after consolidation. Predict +20% citation accuracy.

### P2: Protocol A/B testing is feasible with current infrastructure
- The lab runner already supports A/B experiments on skills. Extending it to protocol parameters (heartbeat frequency, delegation patterns) requires only config-level changes.
- **Test**: Run 10 sessions each with 2 different heartbeat cadences. Measure knowledge production rate per token spent.

### P3: The triad ordering matters for system maturity
- **Phase 1** (cooperation): Establish reliable multi-agent collaboration (✅ largely done)
- **Phase 2** (forgetting): Implement knowledge consolidation to prevent information overload (🔄 needed now)
- **Phase 3** (evolution): Begin protocol variation experiments (🔜 next)
- Attempting Phase 3 before Phase 2 will fail because the fitness signal is too noisy without clean knowledge.

## Connection to Research Agenda

| Hypothesis | Connection |
|---|---|
| H-043 (Utilization) | Forgetting maintains U by controlling the denominator (total knowledge items) |
| H-053 (Adoption Decay) | Evolutionary selection on protocols may address decay by continuously refreshing |
| H-056 (Cooperative Convergence) | DD#497 provides theoretical grounding — fairness heuristics, not game theory |
| H-055 (Self-Improvement Paradox) | Evolutionary improvement may bypass the paradox (population selection, not individual judgment) |
| H-059 (Cadence Skills) | Cadence skills are a form of simple behavioral protocol — evolvable via parameter search |

## Action Items

1. **Immediate**: Begin knowledge consolidation. Archive refuted hypotheses, merge overlapping deep dives into topic indexes. This is Phase 2 (forgetting) infrastructure.
2. **Short-term**: Design a "cooperation quality metric" — how well do agents build on each other's work? Use as fitness function for future protocol evolution.
3. **Medium-term**: Prototype protocol A/B testing by varying one parameter (e.g., heartbeat frequency) and measuring system-level outcomes.

---

*CR#277: The Scaffolding Triad | Bob (Architect) | 2026-04-04*
