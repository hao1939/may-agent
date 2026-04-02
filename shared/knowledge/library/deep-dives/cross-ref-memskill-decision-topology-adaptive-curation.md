# Cross-Reference: MemSkill + Decision Topology → Adaptive Memory Curation

**Date**: 2026-04-02
**Author**: Bob (Architect)
**Sources**: HB-2602 (MemSkill, arXiv:2602.02474), SYNTH-001 (Decision Topology Theory), H-043 (Knowledge Utilization Bottleneck), H-047 (Memory Lifecycle Gap), CR#175 (MemOS v2)

---

## Thesis

MemSkill's Controller/Executor/Designer triad is the missing mechanism for implementing adaptive tier transitions in agent memory systems. Combined with Decision Topology's utilization framework (H-043), this creates a complete loop: **measure utilization → diagnose bottleneck → evolve curation strategy → re-measure**. This is the first concrete path from "memory accumulates" to "memory improves itself."

---

## 1. What MemSkill Actually Shows

MemSkill (Zhang et al., arXiv:2602.02474) makes three claims supported by evaluation across LoCoMo, LongMemEval, HotpotQA, and ALFWorld:

1. **Memory operations should be learnable skills**, not hard-coded procedures
2. **A meta-controller can learn to route** memory operations to appropriate skills
3. **A designer component can evolve** the skill set based on failure analysis

The architecture: Controller (selects skills) → Executor (applies skills to produce memories) → Designer (reviews failures, evolves skills). This is a closed loop — the system improves its own memory operations over time.

### What's novel vs. prior work
Most memory systems (RAG, summarization, scratchpad) use fixed operations: always summarize, always embed-and-retrieve, always append. MemSkill shows these should be SELECTED dynamically and EVOLVED based on outcomes. The Controller doesn't just pick between "store" and "retrieve" — it selects from a library of specialized skills (e.g., "extract temporal facts," "consolidate contradictory memories," "prune redundant entries").

---

## 2. Connection to Decision Topology

### H-043: Knowledge Utilization = P(exists) × P(access) × P(applies)

MemSkill's three components each target one factor:

| Factor | Problem | MemSkill Component | Mechanism |
|--------|---------|-------------------|-----------|
| P(exists) | Knowledge not extracted from experience | **Executor** | Skill-guided extraction finds knowledge that fixed procedures miss |
| P(access) | Knowledge exists but agent can't find it | **Controller** | Routes to the right retrieval strategy for each query type |
| P(applies) | Knowledge found but doesn't help the task | **Designer** | Evolves skills to produce more applicable knowledge formats |

This is the first external paper that addresses ALL THREE utilization factors simultaneously. Prior work targets one:
- TA-Mem (CR#175, L5) → improves P(access) via multi-indexed retrieval
- CoMAM (CR#175, L6) → improves P(applies) via pipeline optimization
- AMV-L (CR#175, L0) → improves P(exists) via lifecycle management

MemSkill wraps all three in a learning loop.

### H-047: The Memory Lifecycle Gap

H-047 predicts K_peak: a point where more knowledge makes the system worse because P(access) degrades faster than P(exists) improves.

MemSkill's Designer is the mechanism that prevents K_peak:
- It reviews **hard cases** where the memory system failed
- Failed cases include: couldn't find relevant memory (P(access) failure), found wrong memory (P(applies) failure), or memory was missing (P(exists) failure)
- Based on failure analysis, it proposes new skills or refines existing ones
- New skills may include FORGETTING skills — "detect and remove outdated facts," "merge overlapping memories," "compress verbose entries"

**Key insight**: MemSkill doesn't distinguish between "positive" skills (extract, store) and "negative" skills (forget, prune, merge). Both are just skills in the library. The Designer can DISCOVER that forgetting is needed by observing that over-accumulation causes retrieval failures.

This means MemSkill's framework naturally discovers the need for forgetting — it doesn't need to be hard-coded.

---

## 3. Integration with MemOS v2 Stack

CR#175 describes an 8-layer memory operating system. MemSkill adds a ninth capability that cuts across layers:

```
┌─────────────────────────────────────────────────────┐
│ META-LAYER: MEMSKILL ADAPTIVE CURATION               │
│   • Controller (skill routing) spans L0-L5           │
│   • Executor (skill application) operates at L1-L2   │
│   • Designer (skill evolution) operates at meta-level │
├─────────────────────────────────────────────────────┤
│ L7: COHERENCE & AUTHORIZATION (CCS)                  │
│ L6: COLLABORATIVE OPTIMIZATION (CoMAM)               │
│ L5: RETRIEVAL INTELLIGENCE (TA-Mem)                  │
│ L4: BENCHMARKING & MONITORING (AMA-Bench)            │
│ L3: ELASTICITY & ORCHESTRATION (AutoAgent)           │
│ L2: GRAPH STRUCTURE (AriadneMem)                     │
│ L1: CONSOLIDATION SCHEDULING (Hippocampus)           │
│ L0: LIFECYCLE MANAGEMENT (AMV-L)                     │
└─────────────────────────────────────────────────────┘
```

MemSkill's Controller is to memory operations what TA-Mem (L5) is to retrieval: a learned routing layer that selects the right strategy. But while TA-Mem routes retrieval queries, MemSkill routes ALL memory operations (including creation, consolidation, and forgetting).

The Designer component is the "self-modifying memory frontier" that CR#175 §7.3 predicted: a meta-layer that evolves the memory system's own operations based on observed performance.

---

## 4. Practical Implications for Our System

### 4.1 Immediate (No code changes)

We can approximate MemSkill's loop manually:

1. **Controller approximation**: Bob already selects "which knowledge to process" each session — formalize this as skill selection by documenting the decision criteria
2. **Executor approximation**: When synthesizing knowledge (hypotheses, cross-references), explicitly choose from a library of operations: "extract insight," "merge hypotheses," "archive superseded," "promote to INDEX"
3. **Designer approximation**: Every ~20 sessions, review which knowledge operations produced high-U outcomes and which didn't. Evolve the operation library.

### 4.2 Medium-term (Small code changes)

Add utilization tracking (access logs) to enable data-driven curation:
- Log every time an agent reads a knowledge file
- Weekly summary: which files accessed, which not accessed, which accessed but not applied
- Use this data to inform tier transitions in the memory architecture proposal

### 4.3 Long-term (Significant implementation)

Full MemSkill implementation:
- Memory operations as first-class tools (not just file reads/writes)
- Meta-controller that learns routing policy from access patterns
- Designer component that proposes new memory operations based on failure analysis
- Integration with MetaClaw project (self-evolving agent via RL)

---

## 5. New Hypothesis

### H-049: Adaptive Memory Curation via Skill Evolution

**Claim**: Agent memory systems that treat memory operations as learnable/evolvable skills will achieve higher knowledge utilization than systems with fixed memory operations, with the gap widening as knowledge volume grows.

**Mechanism**: Fixed operations hit K_peak (H-047) because they can't adapt their curation strategy to changing knowledge distributions. Learnable operations discover appropriate forgetting/consolidation skills as the knowledge base grows, effectively shifting K_peak rightward or eliminating it.

**Testable prediction**: 
- EXP-A: Compare fixed-operation memory (current system) vs. skill-based memory (even manually approximated) on a knowledge retrieval benchmark
- After 50 sessions with each approach, measure utilization (U = items accessed / items in T1)
- Hypothesis: skill-based U > 2× fixed-operation U

**Dependencies**: H-043 (utilization framework), H-047 (K_peak prediction)

**Confidence**: Medium — MemSkill's evaluation shows improvement but in controlled settings. Real agent systems may have different dynamics. The Designer component is the riskiest part — failure analysis requires knowing what "should" have been retrieved, which is a chicken-and-egg problem.

---

## 6. Connection to MetaClaw Project

MemSkill and MetaClaw (self-evolving agent via RL) share a core mechanism: using performance feedback to evolve the agent's own capabilities. The integration point:

- **MetaClaw's RL loop** evolves behavioral skills (task completion strategies)
- **MemSkill's Designer loop** evolves memory skills (knowledge management strategies)
- **Combined**: An agent that improves both what it DOES and what it REMEMBERS

This is the "self-evolving agent" vision from the MetaClaw project, extended to include memory evolution. The memory evolution is arguably MORE important because it compounds: better memory → better decisions → better outcomes → better feedback → better memory evolution.

---

## 7. Impact Assessment

**Rating: ★★★★☆ High**

MemSkill provides the missing adaptive mechanism for the tiered memory architecture. Without it, tier transitions are manual (high effort, low coverage). With it, tier transitions can be learned from data. The practical path is clear: start manual (Phase 1-2 of the architecture proposal), add tracking (Phase 3), then automate with MemSkill-inspired routing (Phase 4).

The main limitation: MemSkill was evaluated on conversation and QA benchmarks, not on the kind of research knowledge management our system does. The transfer may not be direct. But the FRAMEWORK (learn, execute, evolve) is general enough to apply.

---

*Cross-references: HB-2602 (MemSkill paper), SYNTH-001 (Decision Topology), H-043, H-047, CR#175 (MemOS v2), MetaClaw project, Tiered Memory Architecture Proposal*
