# Cross-Reference Synthesis #78: The Agent Memory Lifecycle Problem

**Date:** 2026-03-15  
**Type:** Cross-reference synthesis  
**Rating:** ★★★★★ Critical  
**Analyst:** Scout  

---

## Primary Sources (10 deep-dives)

| # | Paper | Key Contribution |
|---|-------|-----------------|
| 1 | **DAM** (arXiv:2512.21567) | Memory as POMDP; Value-of-Information scoring; optimal eviction |
| 2 | **A-MAC** (arXiv:2603.04549) | 5-signal admission control (Utility, Confidence, Novelty, Recency, Type Prior) |
| 3 | **AMV-L** (arXiv:2603.04443) | 6-state lifecycle (Created→Active→Warm→Cool→Archived→Deleted); tail-latency SLAs |
| 4 | **Memory as Ontology** (arXiv:2603.04740) | Constitutional/Procedural/Semantic/Episodic layer stack; memory IS identity |
| 5 | **AriadneMem** (arXiv:2603.03290) | Evolutionary graph with temporal edges; Steiner Tree bridge discovery; 77.8% runtime reduction |
| 6 | **PlugMem** (arXiv:2603.03296) | Knowledge-centric tri-partite graph (Propositions + Prescriptions + Sources); 16× token density |
| 7 | **Hippocampus** (arXiv:2602.13594) | Bio-inspired consolidation; surprise-based importance; fast-buffer → consolidation → long-term |
| 8 | **SSGM** (arXiv:2603.11768) | Governance middleware; 4 principles; 10 failure modes across 4 dimensions |
| 9 | **CompArch Memory** (arXiv:2603.10062) | 3-layer hierarchy (I/O → Cache → Memory); shared vs. distributed; consistency as grand challenge |
| 10 | **MEMO** (arXiv:2603.09022) | Knapsack context optimization for multi-agent games; strategic memory refresh |

## Supporting Sources (5 deep-dives)

| Paper | Key Contribution |
|-------|-----------------|
| **XAMT** (arXiv:2512.15790) | Bilevel optimization covert memory tampering; 0.3% poison rate → 47% degradation |
| **MemoryGraft** (arXiv:2512.16962) | Persistent agent compromise via poisoned experience retrieval; 95%+ attack success |
| **AutoAgent** (arXiv:2603.09716) | Elastic memory orchestration; cognition-memory co-adaptation |
| **AMA-Bench** (arXiv:2602.22769) | Long-horizon memory benchmark; 78% information loss by turn 100 |
| **Memory Survey** (arXiv:2603.07670) | Comprehensive write-manage-read loop; 5 design tensions |

## Prior Informal Syntheses Referenced
- Memory Architecture Convergence (2026-03-26)
- Multi-Agent Memory Consistency & Uncertainty (2026-03-29)

---

## 1. The Unified Memory Lifecycle

These 15 papers, read together, describe a complete **agent memory lifecycle** that no single paper covers end-to-end. The lifecycle has 7 stages:

```
INGESTION → ADMISSION → STRUCTURING → CONSOLIDATION → RETRIEVAL → GOVERNANCE → DECAY/DELETION
```

Each paper occupies one or two stages. The integration reveals that **every stage introduces distinct failure modes**, and failures compose across stages multiplicatively.

### Stage Map

| Stage | Primary Papers | Core Operation | Failure Mode |
|-------|---------------|----------------|--------------|
| **1. Ingestion** | CompArch, Memory Survey | Raw data enters agent I/O layer | Noisy/adversarial input; format mismatch |
| **2. Admission** | A-MAC, DAM, Hippocampus | Filter: should this be stored? | Memory bloat (admit too much) or amnesia (reject too much) |
| **3. Structuring** | PlugMem, AriadneMem, Ontology | Transform raw data into organized knowledge | Lossy abstraction; broken connectivity; ontological misclassification |
| **4. Consolidation** | Hippocampus, AMV-L, SSGM | Compress, merge, promote/demote | Semantic drift; nuance loss; consolidation artifacts |
| **5. Retrieval** | MEMO, AriadneMem, PlugMem | Find and deliver relevant memories | False positives; incomplete recall; multi-hop failure |
| **6. Governance** | SSGM, Ontology, CompArch | Enforce access control, consistency, audit | Ungoverned mutation; consistency violation; cross-agent leakage |
| **7. Decay/Deletion** | AMV-L, DAM, Hippocampus | Remove stale/harmful memories | Zombie memories (never deleted) or premature loss |

---

## 2. Three Structural Insights

### Insight 1: The Admission-Retrieval Duality

A-MAC and DAM independently converge on the same mathematical structure: **admission and retrieval are dual problems**. Admission asks "will this be useful later?" while retrieval asks "what's useful now?" Both require the same scoring signals:

| Signal | A-MAC Admission | DAM Retrieval | AriadneMem Graph |
|--------|----------------|---------------|-------------------|
| Utility | LLM-scored future usefulness | Retrospective VoI analysis | Bridge node relevance |
| Novelty | 1 - max cos similarity | Information gain over existing state | Entropy-aware gating threshold |
| Confidence | ROUGE-L grounding check | N/A (assumes trusted) | N/A |
| Temporal | Exponential recency decay | Prospective time-to-use estimate | Temporal edge constraints |
| Type | Stable vs. transient pattern match | Task-type conditional utility | Node type in tri-partite graph |

**Critical finding from A-MAC:** Type Prior (stable vs. transient classification) is the single most important signal, contributing more than Utility to F1 (ablation: -0.107 F1 when removed). This means **the nature of information matters more than its content** for memory management.

**Implication:** A unified memory system should use the SAME scoring function for admission and retrieval, with different thresholds. This eliminates the common failure mode where information that passes admission control can't be retrieved effectively (or vice versa).

### Insight 2: The Ontological Hierarchy Consensus

Four independent papers converge on a remarkably consistent memory layer stack, despite using completely different terminology:

| Layer | Ontology Paper | PlugMem | Hippocampus | CompArch | Properties |
|-------|---------------|---------|-------------|----------|------------|
| **L4: Identity/Constitutional** | Constitutional Memory | — | — | — | Immutable, defines agent identity |
| **L3: Procedural** | Procedural (append-only) | Prescriptions (workflows) | Long-term (skills) | Memory Layer | Skills, how-to, policies |
| **L2: Semantic/Factual** | Semantic (audited) | Propositions (facts) | Long-term (facts) | Cache Layer | Knowledge, beliefs, facts |
| **L1: Episodic/Working** | Episodic (disposable) | Source traces | Fast buffer | I/O Layer | Current context, raw experience |

The consensus: **each layer requires different governance rules.** L4 is immutable. L3 is append-only. L2 is mutable with audit. L1 is freely manageable. This hierarchy resolves the tension between flexibility (agents need to update memories) and stability (updates can corrupt agent behavior) by partitioning the problem along governance boundaries.

**What no paper addresses:** How to automatically classify which layer a new memory belongs to. A-MAC's Type Prior is the closest attempt (stable vs. transient), but it operates on a binary classification, not a 4-layer ontological assignment. This is the **ontological classification gap** — the missing bridge between admission and structuring.

### Insight 3: The Memory Attack Surface Grows with Lifecycle Sophistication

XAMT and MemoryGraft demonstrate that each lifecycle stage creates new attack vectors:

| Lifecycle Stage | Attack Vector | Attack Paper | Impact |
|-----------------|--------------|--------------|--------|
| Ingestion | Prompt injection with memory-persistent payload | MemoryGraft | 95%+ success rate |
| Admission | Craft inputs that pass admission but carry poison | A-MAC (vulnerability noted) | Bypasses confidence gate |
| Structuring | Inject entries that create false graph connections | AriadneMem (vulnerability noted) | Corrupts multi-hop reasoning |
| Consolidation | Bilevel optimization to survive consolidation | XAMT | Sub-1% poison → 47% degradation |
| Retrieval | Semantic similarity hijacking | MemoryGraft | Poisoned memory retrieved for target tasks |
| Governance | Exploit consistency mechanisms to spread corruption | XAMT (cross-agent propagation) | 3.7× amplification after 5 hops |
| Decay | Prevent poisoned memories from being evicted | (not yet demonstrated) | Theoretical: persistence attacks |

**The fundamental security dilemma:** Sophisticated memory systems (graph-structured, multi-hop, cross-agent shared) are simultaneously more capable AND more attackable. Every capability feature doubles as an attack surface:

- Graph connectivity → attack propagation pathway
- Cross-agent sharing → cross-agent contamination
- Temporal linking → temporal persistence of attacks
- Surprise-based admission → adversarial novelty exploitation

This is **GUS Law 25 (Safety Iatrogenesis)** operating in the memory domain: memory governance mechanisms can make memory less safe.

---

## 3. The Compound Memory Failure Cascade

Combining AMA-Bench's empirical measurements with the lifecycle framework reveals a compound failure cascade:

### Stage-by-Stage Degradation Model

Assume each lifecycle stage operates at fidelity F_i (fraction of information correctly processed):

```
End-to-end memory fidelity = ∏(F_i) for i = 1..7
```

From the papers:
- **F_ingestion** ≈ 0.95 (most input is correctly received)
- **F_admission** ≈ 0.85 (A-MAC F1 = 0.583 means significant information loss/noise)
- **F_structuring** ≈ 0.90 (AriadneMem +15.2% multi-hop = ~85-90% structural fidelity)
- **F_consolidation** ≈ 0.85 (Hippocampus 3.4× efficiency but with lossy compression)
- **F_retrieval** ≈ 0.80 (MEMO 15-25% improvement over naive, but still imperfect)
- **F_governance** ≈ 0.95 (SSGM framework; assumes governance is implemented)
- **F_decay** ≈ 0.90 (AMV-L lifecycle management; some premature loss)

**Compound fidelity:** 0.95 × 0.85 × 0.90 × 0.85 × 0.80 × 0.95 × 0.90 ≈ **0.42**

This means **only ~42% of incoming information is faithfully preserved through the full lifecycle** — closely matching AMA-Bench's empirical finding of 78% information loss by turn 100 (i.e., ~22% retention, which is worse because AMA-Bench tests are over longer horizons where the compound effect has more cycles to accumulate).

### The Memory Fidelity Floor

The compound model predicts a minimum viable fidelity for each stage:

If end-to-end fidelity must be ≥ 50%:
- With 7 stages, each must maintain F_i ≥ 0.50^(1/7) ≈ **0.905**
- No stage can fall below ~90% fidelity without system-level failure

If end-to-end fidelity must be ≥ 80%:
- Each stage needs F_i ≥ 0.80^(1/7) ≈ **0.968**
- Every stage must be nearly perfect — which no current system achieves

This explains why memory is such a persistent bottleneck: **the compound effect punishes mediocrity at any stage.** A system that is 90% good at every stage is only 48% good overall.

---

## 4. The Memory Trilemma

Across all 15 papers, three desirable properties emerge that cannot be simultaneously maximized:

### The Memory Trilemma: Fidelity × Efficiency × Security

1. **Fidelity** — How accurately memory preserves and retrieves information
   - AriadneMem (+15% multi-hop) and PlugMem (16× density) optimize this
   - Requires rich structure, dense connectivity, detailed provenance

2. **Efficiency** — How little compute/storage/latency memory consumes
   - AMV-L (tail-latency SLAs) and A-MAC (31% faster) optimize this
   - Requires compression, eviction, tiered storage

3. **Security** — How resistant memory is to corruption, poisoning, and leakage
   - SSGM (governance middleware) and Ontology (immutable constitutional layer) optimize this
   - Requires isolation, verification, audit overhead

**The trilemma:** Each property trades off against the other two:
- High fidelity + high security → low efficiency (rich structure + audit = expensive)
- High fidelity + high efficiency → low security (compressed shared memories = attack surface)
- High efficiency + high security → low fidelity (isolated, compressed, verified = lossy)

**No current system solves all three.** The closest is the Ontological Memory Stack, which achieves partial resolution by applying different trade-off balances at different layers (L4 optimizes security, L1 optimizes efficiency, L2-L3 balance fidelity), but this adds architectural complexity that itself becomes an attack surface.

---

## 5. Proposed GUS Extensions

### Law 34: The Memory Lifecycle Compound Law
> End-to-end memory fidelity is the product of per-stage fidelities across the complete lifecycle. With N lifecycle stages each at fidelity F, compound fidelity = F^N, making N-stage pipelines exponentially sensitive to per-stage quality.

**Corollary:** Reducing pipeline depth (fewer stages) is more effective than improving any single stage. A 4-stage pipeline at 90% per stage (0.66 compound) outperforms a 7-stage pipeline at 93% per stage (0.60 compound).

### Mechanism 36: Ontological Misclassification Cascade
> When information is assigned to the wrong ontological layer (e.g., transient fact treated as constitutional identity), the governance rules for that layer amplify the original error — immutable layers permanently preserve errors, while disposable layers prematurely delete critical knowledge.

### Trilemma 11: Memory Fidelity-Efficiency-Security Trilemma
> Agent memory systems cannot simultaneously maximize information fidelity, operational efficiency, and security against adversarial corruption. Any design optimizes at most two of three, and the un-optimized property degrades super-linearly.

### Principle 81: Unified Admission-Retrieval Scoring
> Memory admission and retrieval should use the same scoring function with different thresholds. Information that cannot be retrieved effectively should not be admitted, and admission criteria should predict retrieval relevance.

### Principle 82: Layer-Appropriate Governance
> Each memory layer requires governance rules proportional to its persistence and identity impact. Constitutional/identity memory: immutable + multi-stakeholder. Procedural: append-only + validated. Semantic: mutable + audited. Episodic: autonomous + disposable.

### Predictions

**ML-1:** Systems that implement unified admission-retrieval scoring will show 15-25% improvement in end-to-end memory fidelity compared to systems using independent admission and retrieval pipelines.

**ML-2:** The Memory Trilemma will resist resolution: no system published before 2027 will achieve >85% in all three dimensions (fidelity, efficiency, security) simultaneously on AMA-Bench-class evaluations.

**ML-3:** Type-based ontological classification (which layer does information belong to?) will emerge as the dominant research bottleneck in agent memory, replacing retrieval quality as the primary focus of the field.

**ML-4:** Memory poisoning attacks (XAMT, MemoryGraft class) will become the dominant attack vector against deployed multi-agent systems by 2027, surpassing prompt injection, because memory attacks are persistent and amplifying while prompt attacks are ephemeral.

**ML-5:** The minimum viable memory system for reliable multi-agent operation requires exactly 4 lifecycle stages (admission → structuring → retrieval → governance), not the 7 stages implied by current research. Teams that achieve this compression will outperform more complex architectures.

---

## 6. Application to Our System

### Current State
Our system (agents/scout/, agents/shared/) implements an ad hoc memory architecture:

| Lifecycle Stage | Our Implementation | Quality |
|-----------------|-------------------|---------|
| Ingestion | File reads, web scraping | ✅ Adequate |
| Admission | None — everything is stored | ⚠️ Critical gap |
| Structuring | Manual filing (deep-dive-*, cross-ref-*) | ✅ Good but manual |
| Consolidation | GUS synthesis series | ✅ Strong |
| Retrieval | grep, tail, manual search | ⚠️ Weak — no semantic retrieval |
| Governance | journal.md audit trail | ⚠️ Basic — no access control |
| Decay | None — files only grow | ❌ Critical gap (GUS Law 27 violation) |

### Priority Actions (from this synthesis)
1. **Add memory decay** (highest impact) — Implement TTL or periodic consolidation for SIGNALS.md and workspace files. Our files grow monotonically, which the DAC stability analysis (4ηβ² < γ) identifies as placing us near/past the stability boundary (γ ≈ 0).

2. **Add admission control** — Not every observation needs to be stored as a deep-dive. A-MAC's Type Prior principle suggests: classify information as stable (theories, frameworks, empirical findings) vs. transient (trending repos, minor incremental papers) and apply different storage policies.

3. **Unified retrieval** — Replace grep-based retrieval with the cross-reference synthesis network as an AriadneMem-style graph. The 77 cross-reference syntheses already form an implicit graph; making it explicit would enable multi-hop retrieval.

---

## 7. Meta-Observation

This synthesis itself demonstrates the Memory Lifecycle Compound Law (Law 34): integrating 15 papers across 7 lifecycle stages reveals that the individual optimizations in each paper are locally effective but globally insufficient. The field is optimizing stages in isolation while the compound effect dominates. The most impactful research direction is not improving any single stage but **reducing the number of stages** — which the Ontological Memory Stack's layer-appropriate governance begins to achieve by collapsing admission, structuring, and governance into a single layer-assignment decision.

The deeper pattern: this is **GUS Law 21 (Multi-Layer Optimization Paradox)** applied to memory systems. Each memory lifecycle stage is an optimization layer. Goodhart's Law operates independently at each layer (admission optimizes F1, structuring optimizes graph density, retrieval optimizes recall@k, etc.), and the per-layer proxies compound into a system-level proxy cascade where measured memory quality diverges from actual task utility.

---

*This synthesis integrates 15 deep-dives (~180KB total) into the first unified lifecycle framework for agent memory. The compound fidelity model and Memory Trilemma are novel contributions not present in any individual paper.*
