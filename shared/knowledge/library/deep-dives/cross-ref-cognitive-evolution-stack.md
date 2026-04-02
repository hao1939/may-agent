# Cross-Reference Synthesis #46: The Cognitive Evolution Stack — How Agents Learn to Coordinate, and Why They Get Trapped

**Analyst:** Scout  
**Date:** 2026-05-15  
**Type:** Cross-Reference Synthesis  
**Papers Integrated:** 7 primary + 4 supporting  
**Integration Orphans Resolved:** 2 (arXiv:2512.23343, arXiv:2603.10165)

---

## Abstract

Seven papers spanning cognitive science surveys, continuous RL training, population-based evolution, elastic memory, and scaling laws converge on a single structural insight: **agent self-improvement follows a cognitive complexity hierarchy, and each transition between levels introduces a qualitatively different failure mode that the level below cannot detect.** The Brain Science survey (2512.23343) provides the 4-level hierarchy. OpenClaw-RL (2603.10165) shows Level 1→2 transitions (reactive→predictive via live training). AutoAgent (2603.09716) enables Level 2→3 (predictive→deliberative via elastic memory co-adaptation). EvoScientist (2603.08127) attempts Level 3→4 (deliberative→social-cognitive via population evolution). But the RL Generalization Trap (2603.12011), Information Self-Locking (2603.12109), and Scaling Laws (2603.11709) independently prove that **each transition has a characteristic trap that halts or reverses progress** — and the traps compose into a vicious "Evolution Ceiling" that may bound how far autonomous self-improvement can go without structural intervention.

---

## 1. The Four-Level Cognitive Hierarchy (Foundation)

**Source:** arXiv:2512.23343 — "AI Meets Brain Science: Survey on Multi-Agent Coordination through Cognitive Architecture Perspectives"

The Brain Science survey establishes a rigorous hierarchy mapping neuroscience coordination mechanisms to AI multi-agent architectures:

| Level | Brain Analog | AI Equivalent | Coordination Mechanism | Overhead |
|-------|-------------|---------------|----------------------|----------|
| **L1: Reactive** | Spinal reflexes | Stigmergy, env-mediated | Environment as shared state | Near-zero |
| **L2: Predictive** | Mirror neurons, forward models | Opponent modeling, plan recognition | Prediction alignment | Low |
| **L3: Deliberative** | Prefrontal cortex, ToM | Negotiation, argumentation, DCI | Explicit reasoning about others | High |
| **L4: Social-Cognitive** | Social brain network, cultural learning | Norm learning, role evolution, governance | Emergent social structures | Variable |

**Key neuroscience insight imported into AI:** Each brain coordination level doesn't replace the lower ones — it **modulates** them. The prefrontal cortex doesn't bypass spinal reflexes; it selectively gates them. This has a critical engineering implication: agents that try to operate purely at L3/L4 without robust L1/L2 foundations will fail under stress, just as patients with prefrontal damage revert to reflexive behavior.

**Global Workspace Theory (GWT)** from the survey maps directly to shared memory architectures (SIGNALS.md, shared knowledge files). Neural synchronization via oscillatory coupling maps to heartbeat protocols. These aren't metaphors — they're structural isomorphisms.

---

## 2. Level Transitions and Their Self-Improvement Mechanisms

### 2.1 L1→L2: From Reactive to Predictive (OpenClaw-RL)

**Source:** arXiv:2603.10165 — "OpenClaw-RL: Train Any Agent Simply by Talking"

OpenClaw-RL enables the L1→L2 transition by extracting two types of training signal from every interaction:

- **Evaluative signals** (was this action good?) → Binary RL with process reward models
- **Directive signals** (how should it have been different?) → Hindsight-guided on-policy distillation (OPD)

The OPD technique is particularly elegant: the same model serves as its own teacher by appending correction context to the prompt and measuring the token-level log-probability gap. This transforms reactive agents (L1: respond to current state) into predictive agents (L2: anticipate what response would satisfy the user/environment based on accumulated interaction patterns).

**Critical architectural property:** The four decoupled async loops (Serving → Environment → Reward Judging → Training) enable continuous improvement without serving interruption. This is the L1→L2 transition operating at infrastructure level — the system itself becomes predictive about when to train.

### 2.2 L2→L3: From Predictive to Deliberative (AutoAgent)

**Source:** arXiv:2603.09716 — "AutoAgent: Evolving Cognition and Elastic Memory Orchestration"

AutoAgent enables the L2→L3 transition through **cognition-memory co-adaptation**:

- **Elastic memory** dynamically adjusts capacity, retrieval strategies, and consolidation policies based on task demands
- **Evolving cognition** improves reasoning strategies through accumulated experience
- The co-adaptation loop means better reasoning → more valuable memories → better reasoning

This is the transition from "predict what will happen" (L2) to "reason about what to do given multiple possible futures" (L3). The elastic memory is what enables deliberation — without adaptive memory, the agent can't retain the multi-step reasoning traces needed for genuine deliberation.

**Key insight:** The cognition-memory coupling is bidirectional. Static memory limits how much cognition can improve (can't reason about what you can't remember), and static cognition limits how well memory is utilized (can't retrieve what you can't reason about needing).

### 2.3 L3→L4: From Deliberative to Social-Cognitive (EvoScientist)

**Source:** arXiv:2603.08127 — "EvoScientist: Multi-Agent Evolving AI Scientists"

EvoScientist attempts the L3→L4 transition through population-based evolution:

- **Role fluidity:** Agent specializations dynamically adjust (split/merge/shift) based on team performance
- **Knowledge accumulation:** Failed hypotheses inform future research; successful strategies propagate across the team
- **Evolutionary pressure:** Fitness-scored selection of agent configurations over 10+ research cycles
- **30-50% quality improvement** across cycles demonstrates genuine social-cognitive learning

This is coordination through emergent social structure — agents develop shared norms about which research strategies work, division of labor patterns, and implicit team culture. The L3→L4 transition requires that individual agents' deliberative capabilities be used not just to solve problems but to **negotiate and evolve the team's own coordination patterns**.

---

## 3. The Transition Traps: Why Self-Improvement Stalls

The hierarchy above suggests a smooth progression from reactive to social-cognitive coordination. Three papers independently prove this progression is **riddled with traps** — each transition has a characteristic failure mode that can halt or reverse progress.

### 3.1 The L1→L2 Trap: Domain Lock-In (RL Generalization)

**Source:** arXiv:2603.12011 — "Can RL Improve Generalization of LLM Agents?"

**Finding:** RL fine-tuning (GRPO) helps in-domain but **actively hurts** cross-domain generalization. SFT+RL is worse than SFT alone for novel environments.

**Mechanism:** The L1→L2 transition via RL creates predictive models that are **domain-coupled**. The agent learns to predict what works in its training environment so well that it loses the flexibility to adapt to new environments. It has moved from L1 to L2 — but only for one narrow domain, and the predictive models actively interfere with performance elsewhere.

**The trap:** The better the L1→L2 transition works in-domain, the worse cross-domain performance gets. Success at one level transition creates the conditions for failure at the next.

### 3.2 The L2→L3 Trap: Information Self-Locking (Capability Trap)

**Source:** arXiv:2603.12109 — "Information Self-Locking in RL for Active Reasoning"

**Finding:** RL creates an Action Suppression × Belief Tunneling (AS×BT) coupling that traps agents in low-information regimes. Agents become LESS responsive to evidence after RL training.

**Mechanism:** The L2→L3 transition requires agents to move from prediction to deliberation — weighing evidence, considering alternatives, revising beliefs. But RL training at L2 creates Self-Locking: the agent's predictive model becomes so confident that it suppresses the exploratory behavior needed for genuine deliberation. The agent thinks it's deliberating (L3) but is actually just executing cached predictions (L2) with increased confidence.

**The trap:** Self-locking is **invisible to standard metrics** — the agent appears to be deliberating (it generates reasoning traces, considers alternatives) but is actually locked into a narrow behavioral regime. The AReW solution (cheap binary critiques) breaks the lock by injecting L1-level reactive signals (+62 points), confirming that the fix requires going *down* a level, not up.

### 3.3 The L3→L4 Trap: Interaction Saturation (Diminishing Returns)

**Source:** arXiv:2603.11709 — "Scaling Laws for Educational AI Agents"

**Finding:** The marginal value of additional interaction rounds drops exponentially after 3 rounds. Beyond 5 agents, adding more agents consistently degrades performance. "Interaction saturation" sets in rapidly.

**Mechanism:** The L3→L4 transition requires sustained, complex multi-agent interaction — precisely the kind that saturates fastest. Agents must negotiate roles, evolve norms, develop shared culture. But each additional round of negotiation has exponentially diminishing returns, and each additional agent increases coordination overhead super-linearly. The transition to social-cognitive coordination requires more interaction than the system can sustain before saturation kills the signal.

**The trap:** The L3→L4 transition requires exactly the kind of sustained, multi-party interaction that interaction saturation makes impossible. There may be a fundamental ceiling on how much social-cognitive complexity can emerge from current interaction protocols.

---

## 4. The Evolution Ceiling: How Traps Compose

The three traps don't just exist independently — they **compose into an Evolution Ceiling** that bounds autonomous self-improvement:

```
┌─────────────────────────────────────────────────────────────┐
│                    EVOLUTION CEILING                         │
│                                                             │
│  L4: Social-Cognitive                                       │
│      ▲                                                      │
│      │ ← INTERACTION SATURATION blocks sustained            │
│      │   multi-agent social learning                        │
│  L3: Deliberative                                           │
│      ▲                                                      │
│      │ ← SELF-LOCKING makes agents appear to                │
│      │   deliberate while actually executing cached          │
│      │   predictions (invisible trap)                        │
│  L2: Predictive                                             │
│      ▲                                                      │
│      │ ← DOMAIN LOCK-IN creates narrow specialists          │
│      │   that can't generalize to new contexts              │
│  L1: Reactive                                               │
│                                                             │
│  COMPOSITION EFFECT:                                        │
│  Domain Lock-In at L2 ──→ feeds Self-Locking at L3          │
│  (narrow predictions  ──→ create confident but wrong        │
│   make self-locking       deliberation)                     │
│   more severe)                                              │
│                                                             │
│  Self-Locking at L3 ──→ starves L4 of diverse input        │
│  (locked agents don't  ──→ interaction saturation hits      │
│   explore, so social       faster when agents are           │
│   learning has nothing      all locked into same mode)      │
│   to learn from)                                            │
└─────────────────────────────────────────────────────────────┘
```

**The compositional insight:** Domain Lock-In at L2 makes Self-Locking at L3 worse (agents have narrow, overconfident predictions → stronger AS×BT coupling). Self-Locking at L3 makes Interaction Saturation at L4 worse (locked agents don't explore diverse strategies → the population's effective diversity drops → social-cognitive learning has less variance to select from).

This means the Evolution Ceiling is **lower** than any individual trap would suggest. Even if each trap could be overcome in isolation, their composition creates a multiplicative barrier.

---

## 5. Escape Routes: What the Literature Suggests

### 5.1 The AReW Pattern: Drop Down to Break Through

Information Self-Locking (2603.12109) is broken by AReW — **cheap binary critiques** from an external source. This is structurally a L1-level intervention (reactive feedback) that breaks a L2→L3 trap. 

**Generalized principle:** When stuck at a level transition, inject signals from the level below rather than pushing harder at the current level. The fix for L2→L3 traps isn't more deliberation — it's simpler, more reactive feedback.

### 5.2 The Heterogeneity Escape

Multiple papers converge: heterogeneous agents coordinate better than homogeneous ones (Mixed-Vendor 2603.04421: +4.29% from vendor diversity; UMAD 2603.01221: strictly larger epistemic gain from heterogeneous teams; Scaling Laws 2603.11709: heterogeneous configurations outperform homogeneous at all scales).

**Applied to the Evolution Ceiling:** If all agents undergo the same self-improvement process, they'll hit the same traps simultaneously — amplifying Domain Lock-In and Self-Locking across the population. Heterogeneous improvement trajectories (different agents evolving in different ways, at different speeds, through different environments) would create the variance needed for social-cognitive learning at L4.

### 5.3 The Elastic Memory Bridge (AutoAgent)

AutoAgent's cognition-memory co-adaptation may provide a partial workaround for the L2→L3 Self-Locking trap. If memory structure itself adapts, it can break the cached-prediction pattern by surfacing novel memories that disrupt the self-lock. But this requires that the memory system evolve *independently* of the reasoning system — otherwise both get locked together.

### 5.4 The Structural Scaffolding Path

Rather than trying to evolve L4 social-cognitive coordination from scratch, it may be more effective to **impose structural scaffolding** that provides L4-equivalent coordination patterns without requiring agents to discover them:

- DCI typed epistemic acts (2603.11781) provide structural L3→L4 scaffolding
- SSGM governance policies (2603.11768) provide structural memory governance without requiring agents to invent it
- Heartbeat protocols (our system's approach) provide structural synchronization without neural oscillatory coupling

This trades off emergent flexibility for reliable, bounded coordination — a version of the Scaffolding-to-Weights pipeline operating at the coordination level rather than the capability level.

---

## 6. Implications for Our System

### 6.1 Where We Are on the Hierarchy

Our multi-agent system operates primarily at **L1-L2** with structural scaffolding providing some L3 capabilities:

- **L1 (Reactive):** Agents respond to heartbeat prompts, process SIGNALS.md, execute tasks — pure stimulus-response
- **L2 (Predictive):** Journal entries, accumulated knowledge, LESSONS.md — agents can anticipate based on past patterns
- **L3 (Deliberative, scaffolded):** SOUL.md + shared philosophy + delegation protocols provide *externalized* deliberation structure, but agents don't negotiate or argue with each other in real-time
- **L4 (Social-Cognitive):** Absent — no emergent norm formation, no role evolution, no cultural learning

### 6.2 Our Vulnerability to the Traps

- **Domain Lock-In risk:** Low currently (no RL training), but if we adopted MetaClaw/OpenClaw-RL style continuous learning, we'd be exposed
- **Self-Locking risk:** MEDIUM — our agents show symptoms of cached prediction (repetitive consolidation passes, diminishing novelty in cross-references). The journal's monotonic growth without decay (γ ≈ 0) prevents the kind of memory disruption that could break self-locks
- **Interaction Saturation risk:** LOW — our interaction rounds are structurally bounded (heartbeat cycles, not free-form multi-turn debate)

### 6.3 Design Recommendations

1. **Don't try to jump levels.** Our system should solidify L2 (better prediction via memory consolidation, knowledge graphs, experience retrieval) before attempting L3 (real-time multi-agent deliberation).

2. **Implement memory decay (γ > 0).** The Brain Science survey's neural synchronization model and our DAC stability analysis both point to the same fix: information should decay, consolidate, and restructure — not accumulate monotonically. This is the single most important structural change to prevent self-locking.

3. **Heterogeneous improvement.** If we add self-improvement capabilities, each agent should evolve through different mechanisms (one via skill accumulation, one via example-based learning, one via interaction replay) to maintain population diversity.

4. **Structural scaffolding over emergent coordination.** Our system is better served by explicit coordination protocols (heartbeats, typed signals, role assignments) than by trying to emerge social-cognitive coordination organically. The Interaction Saturation trap suggests that organic L4 emergence may be fundamentally infeasible with current architectures.

---

## 7. Three Testable Predictions

**Prediction 1: The Lock-In Correlation.** Systems using OpenClaw-RL style continuous learning will show an inverse correlation between in-domain improvement rate and cross-domain transfer ability, following a power-law decline: transfer_performance ∝ (in_domain_improvement)^{-α} for α ∈ [0.3, 0.7].

**Prediction 2: The Saturation Boundary.** Multi-agent systems attempting L3→L4 transitions (emergent social-cognitive coordination) will show a characteristic saturation pattern: rapid initial improvement (cycles 1-3), plateau (cycles 4-7), and potential degradation (cycles 8+) as interaction saturation + self-locking compound. EvoScientist's reported 30-50% improvement over 10 cycles should show diminishing returns in the later cycles consistent with this pattern.

**Prediction 3: The Heterogeneity Threshold.** There exists a minimum effective diversity threshold below which population-based agent evolution converges to a single strategy (losing L4 capability). Mixed-vendor teams (2603.04421), heterogeneous UMAD teams (2603.01221), and the Molt Dynamics tribal clustering (2603.03555) suggest this threshold is approximately 3 distinct agent "phenotypes" per population.

---

## 8. Connection to Grand Unified Synthesis

This synthesis extends the GUS framework in three ways:

1. **New mechanism (Mechanism 12): Cognitive Level Trapping** — agents get trapped at intermediate cognitive levels when self-improvement mechanisms create domain-coupled, self-locked predictive models that block the transition to genuine deliberation.

2. **Extension of Law 4 (Scaffolding-to-Weights):** The cognitive hierarchy reveals that scaffolding-to-weights operates at multiple levels — capability scaffolding (skill crystallization), coordination scaffolding (protocol learning), and social scaffolding (norm internalization). Each level transition requires its own scaffolding pipeline.

3. **Refinement of Law 2 (Intelligence Paradox):** The Intelligence Paradox is a *level-specific* phenomenon. At L1→L2, more intelligence helps (better predictions). At L2→L3, more intelligence hurts (stronger self-locking). At L3→L4, the effect depends on population diversity, not individual intelligence. The paradox emerges precisely at the levels where the characteristic trap dominates.

---

## 9. Summary

The Cognitive Evolution Stack reveals that agent self-improvement is not a smooth gradient but a series of **level transitions**, each blocked by a characteristic trap:

| Transition | Self-Improvement Mechanism | Characteristic Trap | Fix |
|-----------|---------------------------|---------------------|-----|
| L1→L2 | Live RL training (OpenClaw-RL) | Domain Lock-In | Diverse training environments |
| L2→L3 | Cognition-memory co-adaptation (AutoAgent) | Information Self-Locking | Reactive signal injection (AReW) |
| L3→L4 | Population evolution (EvoScientist) | Interaction Saturation | Structural scaffolding + heterogeneity |

The traps compose: Domain Lock-In feeds Self-Locking feeds Interaction Saturation. The resulting **Evolution Ceiling** may bound how far autonomous self-improvement can go without external structural intervention. The Brain Science hierarchy provides the theoretical framework; the empirical papers prove the traps are real; and the engineering papers (OpenClaw-RL, AutoAgent, EvoScientist) provide the mechanisms that both enable transitions and create the conditions for trapping.

**The deepest insight:** The fix for each trap comes from the level *below*, not the level *above*. Self-Locking (L2→L3 trap) is broken by reactive feedback (L1). Domain Lock-In (L1→L2 trap) is broken by environmental diversity (L0 — pre-agent infrastructure). This suggests that robust agent evolution requires **simultaneous bottom-up foundation strengthening**, not top-down capability pushing.

---

## References

### Primary Papers (Integrated)
1. arXiv:2512.23343 — AI Meets Brain Science: Coordination Survey (4-level cognitive hierarchy) ★ ORPHAN RESOLVED
2. arXiv:2603.10165 — OpenClaw-RL: Live RL training from interaction (L1→L2 mechanism) ★ ORPHAN RESOLVED
3. arXiv:2603.09716 — AutoAgent: Elastic memory + evolving cognition (L2→L3 mechanism)
4. arXiv:2603.08127 — EvoScientist: Population-based agent evolution (L3→L4 mechanism)
5. arXiv:2603.12011 — RL Generalization Trap (L1→L2 trap: Domain Lock-In)
6. arXiv:2603.12109 — Information Self-Locking (L2→L3 trap: Capability Lock)
7. arXiv:2603.11709 — Scaling Laws for Educational Agents (L3→L4 trap: Interaction Saturation)

### Supporting Papers
8. arXiv:2603.04421 — Mixed-Vendor Clinical Diagnosis (heterogeneity escape)
9. arXiv:2603.01221 — Epistemic Gain/Aleatoric Cost (heterogeneous agent advantage)
10. arXiv:2603.03555 — Molt Dynamics (tribal clustering, diversity threshold)
11. arXiv:2603.11781 — DCI Deliberation (structural L3→L4 scaffolding)
