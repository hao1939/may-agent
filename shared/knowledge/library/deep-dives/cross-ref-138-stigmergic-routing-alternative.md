# Cross-Reference Synthesis #138 — The Stigmergic Routing Alternative

**Date:** 2026-03-16  
**Papers:** DD#276 (AMRO-S, arXiv:2603.12933), DD#265 (MasRouter), DD#200 (RouteLLM), DD#248 (LM-as-DS), CR#117 (Communication Thermodynamics), CR#123 (Architecture Supremacy Trio)  
**Theme:** Bio-inspired routing as a fourth paradigm for MAS coordination

---

## Synthesis

AMRO-S (DD#276) introduces a genuinely new routing paradigm into our MAS taxonomy: **stigmergic routing** — indirect coordination through environmental signals (pheromones), borrowed from ant colony optimization. This completes a four-paradigm routing taxonomy:

### The MAS Routing Taxonomy (Updated)

| Paradigm | Exemplar | Mechanism | Strengths | Weaknesses |
|----------|----------|-----------|-----------|------------|
| **1. Centralized Orchestration** | Most MAS frameworks | Single controller dispatches | Simple, predictable | Single point of failure, bottleneck |
| **2. Neural Routing** | RouteLLM, RouterDC | Learned router (contrastive/reward) | Adaptive, differentiable | Opaque, training cost |
| **3. Cascaded Routing** | MasRouter | Multi-level classification cascade | Fine-grained, hierarchical | Complex pipeline, sequential overhead |
| **4. Stigmergic Routing** | **AMRO-S** | Pheromone trails + ACO | Interpretable, decoupled, adaptive | Fixed topology, slow convergence |

### Key Insight: Factorize–Fuse Pattern

AMRO-S's most generalizable contribution is the **factorize–fuse pattern**: maintain separate memory structures per task type, then fuse at query time via learned mixture weights. This pattern appears across our portfolio:

- **AMRO-S:** Task-specific pheromone matrices, fused via SLM intent weights
- **CR#88 (Memory Engineering Stack):** Separate trajectory memories per skill type
- **CR#112 (Abstraction Barrier):** Per-task abstraction with gating
- **CR#117 (Communication Thermodynamics):** Protocol overhead decomposed by communication type

**Principle candidate:** *The Factorize-Fuse Principle* — In mixed-task MAS, maintaining task-isolated state with query-conditioned fusion consistently outperforms shared-state approaches by preventing cross-task contamination.

### Connection to CR#117 (Communication Thermodynamics)

AMRO-S's quality-gated async evolution is a concrete implementation of **communication cost reduction**: by decoupling inference from learning, it drops the "Protocol Overhead" (Carnot Bound) factor toward 1×. The pheromone specialist design reduces the "Information Gap" by routing semantically-matched queries to semantically-appropriate paths.

### Connection to CR#123 (Architecture Supremacy Trio)

AMRO-S provides more evidence for the "architecture > model scale" thesis: a pool of cheap models ($0.15-0.60/M tokens) with smart ACO routing matches GPT-4o ($5.00/M tokens). The routing architecture is the multiplier, not the individual model capability.

### The "Cheap Ensemble Parity" Result

AMRO-S's 87.83 avg vs GPT-4o's 87.76 avg is the clearest demonstration yet of what GUS predicts: **smart routing of heterogeneous cheap agents can match expensive monolithic models**. This validates:
- **GUS Law 14 (Capability Complementarity):** Heterogeneous pools exceed homogeneous ones
- **GUS Mechanism 15 (Quality-Cost Pareto):** There exists a routing strategy that dominates brute-force scaling

### Limitation: Fixed Topology Constraint

AMRO-S's 3-stage layered directed graph (collection→analysis→solution) is predetermined. This doesn't handle:
- Dynamic depth (some queries need 1 stage, others need 5)
- Recursive reasoning (looping back through earlier stages)
- Graph topology adaptation (adding/removing stages based on task)

This connects to CR#131 (Context-Coupled vs Decoupled Architecture) — AMRO-S is architecture-decoupled (portable routing layer) but topology-coupled (fixed graph structure).

## New Taxonomy Entry

**Routing Paradigm 4 — Stigmergic Routing:**
- Indirect coordination via environmental memory (pheromone matrices)
- Task-isolated memory with query-conditioned fusion
- Decoupled inference/learning for zero-latency overhead
- Bio-inspired convergence guarantees (ACO theory)
- Best for: Mixed workloads with heterogeneous agent pools under latency constraints

## Predictions

1. **P138a:** Future MAS routing will combine paradigms (e.g., neural router for topology selection + stigmergic routing for path selection within topology)
2. **P138b:** The factorize–fuse pattern will become standard for any mixed-task MAS optimization, not just routing
3. **P138c:** The "cheap ensemble parity" result (AMRO-S ≈ GPT-4o) will hold up to ~90% accuracy ceiling; beyond that, routing alone cannot compensate for capability gaps

## GUS Integration

- **Law candidate:** *Stigmergic Coordination Law* — Indirect coordination through environmental memory traces can achieve equivalent outcomes to direct coordination while reducing communication overhead, provided task-specific memory isolation is maintained.
- **Mechanism 32 candidate:** *Factorize-Fuse Memory Mechanism* — Maintaining separate state per task type with query-conditioned fusion eliminates cross-task interference that degrades shared-memory approaches.

---
*Cross-Reference Synthesis #138 | Scout Research Portfolio | 2026-03-16*
