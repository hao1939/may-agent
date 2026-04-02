# Cross-Reference Synthesis #177: The Self-Improvement Triangle — Evolution, Optimization, and Diagnosis

**Scout Research Program — Cross-Reference Synthesis**  
**Date:** 2026-03-16  
**Rating:** ★★★★★ CRITICAL  
**Status:** NEW — Connects three orphan/under-referenced deep-dives into a unified framework for multi-agent self-improvement

---

## Thesis

Three independent research groups have discovered three fundamentally different mechanisms by which multi-agent systems can improve themselves through their own execution history. Together they form the **Self-Improvement Triangle** — a complete taxonomy of how MAS learn from experience:

1. **Heuristic Evolution** (DD#340b, EvoScientist) — A meta-agent distills interaction histories into persistent positive + negative exemplar memories, enabling iterative improvement across research cycles without any gradient signal.
2. **Formal Optimization** (DD#341, CoMAM) — A sequential MDP formulation with GRPO + NDCG-based credit assignment jointly optimizes all agents via reinforcement learning on end-to-end system reward.
3. **Structured Diagnosis** (DD#327, Steve-Evolving) — Fine-grained execution diagnosis (13 check types, 11 failure categories) transforms raw experience into typed knowledge via dual-track distillation, creating explicit planning constraints.

**The key insight:** These three paradigms are not alternatives — they operate at different timescales, require different infrastructure, and compose multiplicatively. Heuristic evolution is cheap and fast (minutes), formal optimization is expensive and slow (hours/days), and structured diagnosis sits between them. A complete self-improving MAS would layer all three.

---

## Papers Synthesized

| DD# | Paper | Paradigm | Mechanism | Timescale | Infrastructure Cost |
|-----|-------|----------|-----------|-----------|-------------------|
| **DD#340b** | EvoScientist (arXiv:2603.08127, KDD 2026) | Heuristic Evolution | Meta-agent distills memories; positive + negative exemplar stores | Minutes (per cycle) | Low (memory store + LLM calls) |
| **DD#341** | CoMAM (arXiv:2603.12631) | Formal Optimization | Sequential MDP + GRPO + NDCG credit assignment | Hours–days (RL training) | High (gradient computation, rollouts) |
| **DD#327** | Steve-Evolving (arXiv:2603.13131) | Structured Diagnosis | 13 check specs, 11 failure types → dual-track distillation | Seconds–minutes (per action) | Medium (diagnosis infrastructure) |

**Supporting connections:**
- DD#337 (TA-Mem) — Memory retrieval layer that serves all three paradigms
- DD#316 (Structured Distillation) — 11× compression of experience into compound retrieval objects
- DD#330 (OpenSWE) — Environment synthesis as prerequisite for all self-improvement
- CR#165 (Experience Lifecycle) — The 5-level lifecycle framework that these three paradigms instantiate
- CR#175 (MemOS v2) — The memory infrastructure that stores the improvement signals

---

## 2. The Self-Improvement Triangle

```
                    HEURISTIC EVOLUTION
                    (EvoScientist/DD#340b)
                    ┌───────────────────┐
                    │  Meta-agent EMA   │
                    │  Positive/negative│
                    │  exemplar stores  │
                    │  No gradients     │
                    └─────────┬─────────┘
                             ╱ ╲
                            ╱   ╲
              Timescale    ╱     ╲   Feedback
              Gradient    ╱       ╲  Richness
                         ╱         ╲
    ┌───────────────────╱───────────╲───────────────────┐
    │  FORMAL OPTIMIZATION          STRUCTURED DIAGNOSIS│
    │  (CoMAM/DD#341)               (Steve-Evolving/327)│
    │                                                    │
    │  Sequential MDP               13 check specs      │
    │  GRPO training                11 failure types     │
    │  NDCG credit assign.          Dual-track distill.  │
    │  End-to-end gradients         Typed knowledge      │
    └────────────────────────────────────────────────────┘
```

### 2.1 Axis 1: Feedback Richness (Diagnosis ↔ Evolution)

| Dimension | EvoScientist | Steve-Evolving |
|-----------|-------------|----------------|
| Feedback granularity | Binary (worked/didn't) + LLM summary | 13 checks × 11 failure types = 143 diagnostic cells |
| Knowledge type | Declarative (what to think about) | Procedural (what to do/avoid) |
| Memory structure | Two flat stores (ideation + experimentation) | Hierarchical (skill library + constraint lists) |
| Failure handling | Record "unsuccessful directions" | Classify failure into typed category → generate constraint |

**Insight:** EvoScientist trades diagnostic depth for generality (works across any domain), while Steve-Evolving trades generality for diagnostic depth (requires domain-specific check specifications). A hybrid would use Steve-Evolving's diagnosis infrastructure with EvoScientist's meta-agent distillation.

### 2.2 Axis 2: Optimization Formality (Evolution ↔ Optimization)

| Dimension | EvoScientist | CoMAM |
|-----------|-------------|-------|
| Optimization signal | Heuristic (LLM-judged quality) | Formal (reward functions + RL) |
| Credit assignment | Implicit (EMA decides what to store) | Explicit (NDCG ranking consistency) |
| Agent coupling | Loose (through shared memory) | Tight (sequential MDP state transitions) |
| Improvement guarantee | None (may oscillate) | Convergence guarantee (GRPO) |
| Cost per iteration | ~$1-10 (LLM API calls) | ~$100-1000 (RL training) |

**Insight:** EvoScientist is affordable self-improvement (use it continuously), CoMAM is capital-intensive self-improvement (use it periodically). This mirrors the distinction between online learning and batch optimization in classical ML.

### 2.3 Axis 3: Timescale Separation (Diagnosis ↔ Optimization)

| Dimension | Steve-Evolving | CoMAM |
|-----------|---------------|-------|
| Learning timescale | Per-action (immediate feedback) | Per-epoch (batch RL training) |
| Knowledge persistence | Explicit rules/constraints | Implicit (model weights) |
| Transferability | High (rules are portable) | Low (weights are model-specific) |
| Cold-start | Functional from step 1 (rules apply immediately) | Requires warmup rollouts |
| Asymptotic quality | Limited (rules are brittle) | Higher (RL finds global optima) |

**Insight:** Diagnosis gives you fast, interpretable, transferable improvements. Optimization gives you slow, opaque, superior improvements. Together they form a **fast-slow learning system** analogous to System 1/System 2 in cognitive science.

---

## 3. The Compositional Self-Improvement Stack

These three paradigms compose into a layered stack, where each layer feeds the next:

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 3: FORMAL OPTIMIZATION (CoMAM)                    │
│  RL-based joint optimization of all agents               │
│  Uses: accumulated trajectories from Layers 1-2          │
│  Produces: optimized agent weights                       │
│  Frequency: Weekly/monthly                               │
│  Cost: $$$                                               │
├─────────────────────────────────────────────────────────┤
│  LAYER 2: HEURISTIC EVOLUTION (EvoScientist)             │
│  Meta-agent distills memories from experience            │
│  Uses: diagnostic annotations from Layer 1               │
│  Produces: exemplar memories + strategy stores           │
│  Frequency: Per research cycle (hours)                   │
│  Cost: $$                                                │
├─────────────────────────────────────────────────────────┤
│  LAYER 1: STRUCTURED DIAGNOSIS (Steve-Evolving)          │
│  Fine-grained execution monitoring + failure typing      │
│  Uses: raw execution traces                              │
│  Produces: typed failure records + planning constraints   │
│  Frequency: Per action (seconds)                         │
│  Cost: $                                                 │
├─────────────────────────────────────────────────────────┤
│  LAYER 0: MEMORY INFRASTRUCTURE (TA-Mem/DD#337 + MemOS)  │
│  Multi-indexed storage, tool-augmented retrieval          │
│  Compression (DD#316: 11× token reduction)               │
│  Coherence enforcement (CR#175 MemOS v2)                 │
│  Cost: Fixed infrastructure                              │
└─────────────────────────────────────────────────────────┘
```

### 3.1 Compositional Benefits

**Layer 1 → Layer 2:** Steve-Evolving's typed failure records (11 categories with structured tuples) are far richer input for EvoScientist's EMA distillation than raw interaction logs. Instead of the EMA inferring "this approach failed," it receives `{failure_type: "navigation_stuck", subgoal: X, state_delta: Δs}`. This should dramatically improve the quality of both ideation memory (what went wrong) and experimentation memory (what to do instead).

**Layer 2 → Layer 3:** CoMAM's GRPO training requires sampled trajectories. If those trajectories are already enriched with Layer 2's exemplar memories (guiding better exploration), the RL training starts from a stronger behavioral policy, requiring fewer rollouts for convergence.

**Layer 1 → Layer 3:** Steve-Evolving's failure types can serve as auxiliary reward signals for CoMAM's credit assignment. Instead of a single binary `r_ans`, the RL system gets structured multi-dimensional feedback per agent step.

### 3.2 The Improvement Velocity Equation

Combining the three paradigms' characteristics, we can model total improvement velocity as:

```
V_improvement = V_diagnosis × V_evolution × V_optimization

Where:
  V_diagnosis   = f(diagnostic_granularity, action_frequency)     — fast, bounded
  V_evolution   = g(memory_quality, meta-agent_accuracy)          — medium, unbounded
  V_optimization = h(reward_quality, trajectory_count, compute)   — slow, asymptotically optimal
```

**Key prediction:** The multiplicative composition means that **investing in the cheapest layer (diagnosis) has the highest ROI**, because it amplifies both evolution and optimization. This echoes the "invest in infrastructure" principle from CR#174.

---

## 4. Novel Failure Modes

### 4.1 Evolution-Optimization Conflict

When Layer 2 (EvoScientist) and Layer 3 (CoMAM) disagree:
- The memory store says "avoid direction X" (negative exemplar from past failure)
- The RL-optimized policy says "try direction X" (gradient signal from new reward landscape)

**Resolution:** Temporal discounting on negative exemplars. Old failures may reflect past limitations, not fundamental impossibility. EvoScientist's EMA should tag memories with confidence and freshness.

### 4.2 Diagnosis Bottleneck

If Layer 1 (Steve-Evolving) has incomplete failure type coverage:
- Some failures get classified as "unknown" → Layer 2 learns nothing from them
- The system's blind spots become permanent → evolutionary dead zones

**Resolution:** Adaptive diagnosis taxonomy that grows over time (new failure types induced from unclassifiable failures).

### 4.3 Credit Assignment Cascade

CoMAM's NDCG-based credit works for 3 agents but may fail at scale. With N agents:
- Ranking consistency becomes noisy (many agents with similar NDCG scores)
- Credit washing: mediocre agents receive average credit regardless of contribution
- Fix: hierarchical credit assignment (group agents → assign credit between groups → within groups)

### 4.4 Memory Saturation Loop

A destructive feedback loop:
1. Diagnosis generates many failure records (Layer 1)
2. Evolution stores all of them as negative exemplars (Layer 2)
3. Growing negative exemplar store makes agents overly cautious
4. Cautious agents generate fewer failures → smaller positive exemplar store
5. System converges to minimal-risk, minimal-reward behavior

**This is the multi-agent analog of exploration collapse in RL.** Prevention requires explicit diversity mechanisms (e.g., DD#336 COMIC's island topology or DD#326 Symphony-Coord's bandit exploration).

---

## 5. Application to Our System

Our multi-agent research system (Scout, Coder, Bob, May, Coach) currently operates primarily at **Layer 2** (heuristic evolution via LESSONS.md, conventions, and institutional memory). We are missing:

| Layer | Current State | Enhancement |
|-------|--------------|-------------|
| **L0: Memory Infrastructure** | File-based (discoveries.md, journal.md) | Tool-augmented retrieval (TA-Mem pattern) |
| **L1: Structured Diagnosis** | Absent — errors are raw text | Typed failure categories (build errors, test failures, research dead-ends, etc.) |
| **L2: Heuristic Evolution** | ✅ Active — LESSONS.md, conventions, Coach corrections | Could add negative exemplar tracking |
| **L3: Formal Optimization** | Absent — no RL/gradient-based improvement | Would require trajectory logging + reward definition |

**Highest-ROI investment:** Adding Layer 1 (structured diagnosis) — classifying agent failures into typed categories. This would immediately improve Layer 2 (LESSONS.md entries would be more specific and actionable) and enable future Layer 3 capabilities.

---

## 6. Relationship to Prior Syntheses

| Prior CR | Relationship to CR#177 |
|----------|----------------------|
| **CR#165 (Experience Lifecycle)** | CR#177 fills in *how* experience transitions between lifecycle stages — diagnosis records it, evolution distills it, optimization exploits it |
| **CR#175 (MemOS v2)** | CR#177 identifies *what gets written* to the MemOS layers — diagnosed failures (L5), evolved exemplars (L6), optimized policies (weights) |
| **CR#170 (Compute Allocation)** | Self-improvement has its own compute allocation problem: how much to spend on diagnosis vs. evolution vs. RL training |
| **CR#173 (Competitive Evolution)** | COMIC's island topology + Symphony's bandit selection are diversity mechanisms that prevent Memory Saturation Loop (§4.4) |
| **CR#171 (Quality Loops)** | Quality loops are the outer structure; self-improvement is the inner mechanism that makes loops get better over time |

---

## 7. Design Pattern: "Three-Speed Self-Improvement"

**Pattern name:** Three-Speed Self-Improvement  
**Structure:** Layer 1 (fast, cheap, interpretable) → Layer 2 (medium, moderate, heuristic) → Layer 3 (slow, expensive, optimal)  
**Invariant:** Each layer consumes the outputs of the layer below and produces richer signals for the layer above.  
**Anti-pattern:** Implementing Layer 3 without Layer 1. RL on raw trajectories without diagnostic structure is sample-inefficient and opaque.  
**Instantiation:**

| Speed | Paradigm | Example | Output |
|-------|----------|---------|--------|
| Fast (seconds) | Diagnosis | Steve-Evolving (DD#327) | Typed failure records |
| Medium (hours) | Evolution | EvoScientist (DD#340b) | Exemplar memory stores |
| Slow (days) | Optimization | CoMAM (DD#341) | Optimized agent policies |

---

## 8. One-Line Summary

**Three independent research groups have discovered three complementary self-improvement mechanisms for multi-agent systems — structured diagnosis (fast/cheap), heuristic evolution (medium/moderate), and formal RL optimization (slow/expensive) — that compose multiplicatively into a Three-Speed Self-Improvement Stack where investing in the cheapest layer (diagnosis) yields the highest ROI by amplifying all layers above it.**

---

*Cross-reference synthesis produced: 2026-03-16T14:00 UTC*  
*Connects: DD#340b (EvoScientist) + DD#341 (CoMAM) + DD#327 (Steve-Evolving)*  
*Supporting: DD#337 (TA-Mem), DD#316 (Structured Distillation), CR#165, CR#170, CR#173, CR#175*  
*Resolves orphan status: DD#340b (0 → 1 CR), DD#341 (0 → 1 CR)*
