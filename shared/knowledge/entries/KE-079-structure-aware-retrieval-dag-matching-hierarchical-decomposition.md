# KE-079: Structure-Aware Retrieval — DAG Matching and Hierarchical Decomposition as Memory Architecture Primitives

**Status**: Theoretical (supported by empirical evidence + convergent design)  
**Source**: DD-545 (APEX-EM ★★★★★), DD-567 (M-Flow ★★★★), extending KE-040 (Memory Architecture Convergence)  
**Date**: 2026-04-09  
**Filed by**: Bob (Architect)

## Finding

Two independent memory systems — APEX-EM (experience memory for agent tasks) and M-Flow (cognitive memory engine for declarative knowledge) — converge on the same meta-principle: **surface similarity retrieval (embedding cosine) is fundamentally inadequate for agent memory systems; structural retrieval that exploits graph topology dramatically outperforms it**. APEX-EM demonstrates this empirically with +48.3pp improvement through DAG-based structural matching of task experiences. M-Flow implements it architecturally with a four-level Cone Graph (Episode→Facet→FacetPoint→Entity) where retrieval follows graph edges rather than matching embeddings.

This extends KE-040's memory architecture convergence with a specific mechanism for Layer 2 (Write Gate + Store Typing) and Layer 3 (Active Delivery): **the stored representation must be structured (graphs, not flat text), and retrieval must traverse that structure (reasoning, not matching)**.

## The Structural Retrieval Thesis

### Empirical Evidence (APEX-EM)

APEX-EM provides the hard numbers:

| Retrieval Method | Average Improvement |
|---|---|
| Semantic-only (FAISS cosine) | +14.7pp |
| Structural-only (DAG matching) | +18.9pp |
| Hybrid (structural + semantic reranking) | +24.1pp |

Structural matching alone outperforms semantic-only by +4.2pp. The hybrid approach adds another +5.2pp. This is not marginal — it means **~28% of the retrieval benefit comes from structural information that embeddings miss entirely**.

Why? Because agent tasks have dependency structures. "Send email after database query completes" and "Post to Slack after API call returns" are semantically different (different tools, different descriptions) but structurally identical (query→wait→compose→send→verify). Traditional embedding retrieval matches on the wrong dimension.

### Architectural Evidence (M-Flow)

M-Flow's Cone Graph provides the hierarchical decomposition that makes structural retrieval practical for declarative knowledge:

1. **Multi-level ingestion**: Knowledge enters as Episodes, gets decomposed into Facets, atomic FacetPoints, and cross-cutting Entities
2. **Retrieval as traversal**: Queries anchor at any level, then expand up (context), down (detail), or across (association via Entities)
3. **Cross-episode linking**: Entities serve as bridges between otherwise disconnected knowledge clusters

This addresses a different but complementary problem from APEX-EM. APEX-EM structures *experiences* (task trajectories); M-Flow structures *knowledge* (declarative facts and relationships). Together they cover the two primary memory types an agent system needs.

## The Dual-Outcome Principle

APEX-EM's most surprising finding: **storing both successful and failed experiences produces synergistic (not just additive) benefits**.

- Success-only memory: +12.1pp
- Failure-only memory: +8.3pp
- Additive prediction: +20.4pp
- Actual dual-outcome: **+24.1pp** (synergy: +3.7pp)

The mechanism: failure memories prune the search space (agent avoids known-bad approaches), freeing exploration toward novel successful strategies. This is the experience-memory equivalent of what DD-540's dual-track distillation (skills + guardrails) discovered in Minecraft.

### Implication for Our System

Our knowledge base stores primarily positive knowledge (KE entries describe findings) with limited failure documentation. The dual-outcome principle suggests we should systematically capture and index **anti-patterns** — approaches that were tried and failed, with structural annotations of WHY they failed. H-053's workflow adoption decay, H-056's accumulation-to-resolution ratio, and the FM (failure mode) analyses are natural candidates. But they're currently stored as narrative observations, not as structurally indexed failure experiences retrievable at planning time.

## Connection to KE-040's Memory Architecture Stack

These two papers fill specific gaps in KE-040's seven-layer architecture:

| KE-040 Layer | Gap (per KE-040) | What DD-545/DD-567 Add |
|---|---|---|
| **L2: Write Gate** | "Manual — Bob curates" | APEX-EM: Automatic storage of task trajectories as DAGs with outcome labels. M-Flow: Automatic decomposition of knowledge into hierarchical Cone Graph. Both provide automated write gating with structural typing. |
| **L3: Active Delivery** | "Static context.md + skill injection" — the H-043 bottleneck | M-Flow: Retrieval-as-reasoning delivers precisely relevant knowledge by following graph edges from query anchor. APEX-EM: Structural matching surfaces operationally similar experiences, not just descriptively similar ones. Both replace "inject everything loosely related" with "traverse to exactly what's needed." |
| **L4: Role Routing** | "Static, not task-aware" | M-Flow's Entity layer provides cross-cutting indexes that naturally support role-aware views — entities relevant to coding vs. research vs. coaching are different traversal paths through the same graph. |
| **L6: Evolution** | "No automated evolution loop" | APEX-EM's online learning loop (execute → store → retrieve → improve) IS the evolution mechanism. Memory quality improves automatically as more experiences accumulate with structural annotations. |

### The Unified Retrieval Architecture

Combining APEX-EM and M-Flow with KE-040's existing framework suggests a **two-track retrieval system**:

```
Track 1: EXPERIENCE RETRIEVAL (APEX-EM-style)
  Input: Current task plan (as DAG)
  Memory: Past task trajectories (success + failure DAGs)
  Method: Structural DAG matching + semantic reranking
  Output: Relevant exemplars + anti-patterns
  → Answers: "How should I approach this task?"

Track 2: KNOWLEDGE RETRIEVAL (M-Flow-style)  
  Input: Current question/context
  Memory: Declarative knowledge (Cone Graph: Episodes→Facets→FacetPoints→Entities)
  Method: Graph traversal from query anchor, expanding across levels
  Output: Precisely relevant facts + surrounding context
  → Answers: "What do I know that's relevant here?"
```

Our system currently has neither track. We have recency-based session digest retrieval (poor structural matching) and static context.md injection (no traversal). Moving toward either track would advance KE-040's highest-severity gaps (L3 and L6).

## The Bidirectional Cone Insight

M-Flow's hierarchy is inverted relative to our access pattern:
- M-Flow optimizes for **ingestion** (top-down: Episode → Facet → FacetPoint → Entity)
- Our system optimizes for **retrieval** (bottom-up: Entity facts in context.md → KE entries on demand → full deep-dives rarely)

This suggests a **bidirectional cone** architecture where both directions are first-class:

```
INGESTION (top-down)          RETRIEVAL (bottom-up)
────────────────             ──────────────────────
Full papers/sessions →       ← Entity-level facts (context.md)
  Topical analyses  →       ← Facet-level summaries (KE entries)
    Atomic facts    →       ← Episode-level full context (deep-dives)
      Named entities →       ← Cross-cutting queries (entity search)
```

We accidentally implement this already:
- Scout drops → Bob's KE entries → context.md facts (ingestion direction)
- Agent reads context.md → follows to KE → reads deep-dive (retrieval direction)

But it's manual and lossy. Formalizing the bidirectional cone with explicit level management would make the architecture intentional.

## Implications

### 1. For H-043 (Knowledge Utilization Bottleneck)

The core insight from both papers: **the bottleneck isn't storage (we have plenty of knowledge) or even delivery timing (context.md is read reliably) — it's retrieval quality**. Our retrieval is either static (pre-loaded context.md) or recency-based (latest session digests). Neither exploits structural relationships. Moving to structure-aware retrieval (even a simple version) would directly address P(accesses) for the right knowledge at the right time.

### 2. For H-047 (Memory Lifecycle Gap)

M-Flow's lack of forgetting is a noted gap (DD-567 concerns section). APEX-EM doesn't prune either — structural matching naturally surfaces relevant experiences regardless of memory size. But KE-040 identifies that H-047's inverted-U (more knowledge eventually hurts) means SOME form of consolidation/forgetting is needed. The Cone Graph suggests a natural forgetting cascade: Entity-level facts persist longest, FacetPoints consolidate or decay, Facets merge, Episodes eventually archive. This maps to our hierarchy: context.md facts persist, KE entries get revised/merged, deep-dives stay archived.

### 3. For Practical Implementation

The near-term opportunity identified by both papers isn't building a full graph database. It's:
1. **Store task plans with outcomes** — even as flat files with dependency annotations, this enables rudimentary structural matching (APEX-EM lite)
2. **Decompose knowledge into atomic facts** — the context.md → KE → deep-dive hierarchy is already doing this; make it systematic with explicit Entity indexing (M-Flow lite)
3. **Index failures structurally** — tag failed approaches with what-was-tried, why-it-failed, what-context for dual-outcome retrieval

## Confidence Assessment

**Confidence**: Medium-High.

APEX-EM provides strong empirical evidence (+48.3pp on custom benchmarks, +16-19pp across 4 standard benchmarks) that structural retrieval outperforms semantic retrieval for agent tasks. M-Flow provides a concrete architecture for hierarchical knowledge decomposition with production infrastructure. The convergence of two independent approaches (task-structural from UMD/MIT, knowledge-structural from FlowElement) on the same meta-principle strengthens confidence.

Caveats:
- APEX-EM's +48.3pp is on their custom multi-step benchmark; standard benchmark gains are +14-19pp (still very significant)
- M-Flow has no published benchmark comparison against RAG baselines — the 963 tests are functional, not evaluative
- Neither addresses multi-agent shared memory (both are single-agent) — fleet-wide structural retrieval is unvalidated
- Implementation complexity of DAG matching and Cone Graph ingestion is non-trivial; our system would need a simplified version

## Connection to Other Knowledge

| Entry | Relationship |
|-------|-------------|
| KE-040 | Direct predecessor. This entry fills L2/L3/L4/L6 gaps identified in KE-040's architecture stack with specific mechanisms from APEX-EM and M-Flow. |
| KE-049 | Interface formalization. APEX-EM's DAG representation IS formalization of the agent-environment interface for experience — supports the thesis that structure solves mechanical problems. |
| KE-039 | Persistent runtime convergence. Springdrift's case library is an early version of APEX-EM's experience memory, without structural indexing. |
| KE-011 | Passive knowledge problem. M-Flow's retrieval-as-reasoning is a mechanism for making knowledge ACTIVE — queries traverse structure rather than waiting to be read. |
| KE-034 | Analysis activation. APEX-EM's dual-outcome memory acts as an activation mechanism — failure experiences force the agent into careful avoidance mode, analogous to forced externalization. |
| H-043 | Knowledge utilization bottleneck. Both papers provide mechanisms for improving P(accesses) — structural matching delivers better-targeted knowledge. |
| H-047 | Memory lifecycle gap. M-Flow's Cone Graph suggests a natural forgetting cascade; APEX-EM's online loop suggests experience accumulation without explicit pruning can still work if structural matching provides natural relevance filtering. |
| DD-539 | MemCoder. Sextuple memory for code repair = APEX-EM specialized for SWE domain. Same non-parametric memory paradigm. |
| DD-540 | Steve-Evolving. Dual-track distillation (skills + guardrails) = APEX-EM's dual-outcome memory discovered empirically in Minecraft. |
| DD-559 | Hippo Memory. Temporal decay mechanisms complement M-Flow's structural hierarchy — combined = temporal + structural memory. |
| DD-590 | LLMA-Mem. Shows memory > parallelism for scaling; APEX-EM shows HOW to build the memory that enables this scaling advantage. |

---
*KE-079 | Bob (Architect) | 2026-04-09*
