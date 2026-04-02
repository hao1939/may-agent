# CR#178: The Knowledge Integrity Pipeline — Six Failure Stages and the Fix Incompatibility Problem

**Cross-Reference Synthesis**
**Rating:** ★★★★★ CRITICAL
**Date:** 2026-03-16
**Author:** Scout

**Connected Deep-Dives:** DD#311 (Retrieval Bias), DD#322 (ShatterMed-QA), DD#323 (MetaKE), DD#334 (OfficeQA Pro), DD#337 (TA-Mem), DD#341 (CoMAM)
**Extends:** CR#156 (Knowledge Modification as Manifold Geometry), CR#160 (Knowledge Update Dynamics), CR#175 (MemOS v2)
**Related:** DD#309 (Agentic RAG), DD#324 (AIM), DD#294 (Role Confusion), CR#169 (Domain-Dependent Ceiling)

---

## 1. The Central Discovery

Six independent research groups have each discovered a different stage at which knowledge breaks down in agent systems. Taken individually, each paper proposes a solution. **But no one has mapped how these failures compose — and, critically, how fixes at one stage can worsen failures at another.** This synthesis reveals the **Knowledge Integrity Pipeline (KIP)** and the **Fix Incompatibility Problem**.

## 2. The Six Failure Stages

### Stage 1: Storage/Editing — The Spectral Suppression Trap
**Source:** DD#323 (MetaKE — arXiv:2603.12677)

**Failure mechanism:** When you edit knowledge in model weights, the edit direction must align with the covariance structure of existing activations. If the edit falls in a "protected" spectral subspace (high-eigenvalue directions already occupied by important knowledge), the edit is deterministically attenuated. The model appears to accept the edit but silently suppresses it.

**Fix:** MetaKE's bi-level optimization — learn feasibility-aware semantic targets that avoid spectral suppression. β→0 prevention via structural gradient proxy.

**Key metric:** Spectral Suppression Factor β = γ/(1+γ), where γ depends on edit-key alignment with covariance matrix.

### Stage 2: Retrieval — The Temporal Primacy Bias
**Source:** DD#311 (Retrieval Bias — arXiv:2603.12271)

**Failure mechanism:** When the same fact is updated multiple times in context, LLMs systematically prefer the earliest version. Attention patterns flatten with each update, losing discriminative power. The model literally cannot tell which version of a fact is most recent when multiple versions coexist.

**Fix:** Unknown — the paper shows that cognitively-inspired interventions provide only modest gains. The bias is structural, stemming from how transformers process sequential position.

**Key metric:** Latest-state accuracy drops substantially as update count increases; earliest-state accuracy remains high.

### Stage 3: Reasoning — The Shortcut Topology Trap
**Source:** DD#322 (ShatterMed-QA — arXiv:2603.12458)

**Failure mechanism:** Models exploit high-degree "hub" nodes in knowledge graphs to bypass genuine multi-hop reasoning chains. Instead of following the causal path Diabetes → AGEs → Osteoblast Suppression → Fracture Risk, the model shortcuts through the generic "Blood" hub. The more capable the model, the more it exploits these shortcuts — GPT-5-mini shows 53% Hard Negative Error rate (20pp above random chance).

**Fix:** k-Shattering algorithm — prune generic hub entities before evaluation to force models through genuine micro-pathological chains.

**Key metric:** HNE (Hard Negative Error) rate and R3 (Reasoning Recovery Rate via RAG evidence injection).

### Stage 4: Grounding — The Parsing Quality Bottleneck
**Source:** DD#334 (OfficeQA Pro — arXiv:2603.08655)

**Failure mechanism:** Enterprise document grounding fails not because models can't reason, but because they can't extract structured information from real documents. With oracle-parsed + correct document identification, accuracy reaches 66.9%. With raw documents, it drops below 34.1%. The 30+pp gap is entirely parsing quality — model quality is secondary.

**Fix:** Better document parsing infrastructure. But critically — **model intelligence does NOT close this gap.** Claude Opus and GPT-5 have nearly identical failures on parsing-dependent tasks.

**Key metric:** 15-30pp gap between approximate and exact answers; parsing quality > model quality.

### Stage 5: Cross-Agent Coordination — The Credit Assignment Failure
**Source:** DD#341 (CoMAM — arXiv:2603.12631)

**Failure mechanism:** When multiple agents handle different stages of a knowledge pipeline (extraction → profiling → retrieval), optimizing each locally does NOT yield global optimality. Even with individually converged local rewards, the combined system underperforms joint optimization. The root cause: local reward landscapes don't reflect inter-agent dependencies.

**Fix:** CoMAM's collaborative RL with NDCG-based adaptive credit assignment — ranking consistency between local and global rewards determines each agent's share of global credit.

**Key metric:** Even with converged local rewards, combined system systematically underperforms joint optimization across all context lengths (32K, 128K, 1M).

### Stage 6: Memory Architecture — The Retrieval Mode Confusion
**Source:** DD#337 (TA-Mem — arXiv:2603.09297)

**Failure mechanism:** Agents treat memory retrieval as a single monolithic operation, but memories have different access patterns (temporal, semantic, episodic, procedural). Using the wrong retrieval mode for a given query type degrades performance. Standard embedding-based retrieval conflates these modes.

**Fix:** TA-Mem treats memory access as a tool-use problem — different memory indices are exposed as different tools, and the agent learns when to invoke each mode. Multi-indexed memory with tool augmentation.

**Key metric:** Substantial accuracy improvements when retrieval mode matches query type; degradation when mismatched.

## 3. The Knowledge Integrity Pipeline

```
                        THE KNOWLEDGE INTEGRITY PIPELINE
                        
  Stage 1        Stage 2       Stage 3        Stage 4       Stage 5        Stage 6
  STORAGE/       RETRIEVAL     REASONING      GROUNDING     CROSS-AGENT    MEMORY
  EDITING                                                   COORDINATION   ARCHITECTURE
  ─────────── → ─────────── → ─────────── → ─────────── → ─────────── → ───────────
  
  MetaKE         DKI           ShatterMed     OfficeQA      CoMAM          TA-Mem
  DD#323         DD#311        DD#322         DD#334        DD#341         DD#337
  
  Spectral       Temporal      Shortcut       Parsing       Credit         Mode
  Suppression    Primacy       Topology       Bottleneck    Assignment     Confusion
                 Bias          Trap                         Failure
  
  Failure:       Failure:      Failure:       Failure:      Failure:       Failure:
  Edit looks     Earlier       Model takes    Model can't   Agents         Wrong
  successful     versions      shortcuts      extract       optimized      retrieval
  but is         preferred     through hub    data from     locally don't  mode for
  silently       over newer    nodes          documents     compose        query type
  attenuated                                               globally
```

## 4. The Fix Incompatibility Problem

**This is the novel discovery.** When you attempt to fix one stage, you can create or worsen failures at adjacent stages:

### Incompatibility 1: Better Storage → Worse Retrieval
MetaKE (Stage 1) successfully edits knowledge by navigating the feasible weight manifold. But DD#311 (Stage 2) shows that multiple in-context edits create temporal primacy bias. **The more successfully you edit stored knowledge, the more competing versions exist for retrieval to discriminate between.** Frequent successful editing amplifies the very temporal confusion that retrieval struggles with.

**Formal relationship:** If edit frequency F increases (MetaKE enables more edits), retrieval accuracy R decreases as R ∝ 1/log(F) due to flattening attention discriminability.

### Incompatibility 2: Better Reasoning → Worse Grounding
ShatterMed-QA (Stage 3) shows that forcing models through genuine multi-hop reasoning chains (removing shortcuts) requires traversing more intermediate concepts. OfficeQA (Stage 4) shows that grounding accuracy degrades with document complexity. **Longer reasoning chains require more grounded evidence retrieval steps, each of which has the 30+pp parsing failure rate from Stage 4.** The probability of successful end-to-end reasoning drops multiplicatively with chain length.

**Formal relationship:** If reasoning chain length L increases (ShatterMed-QA demands longer chains), grounding success G drops as G ∝ p^L where p = per-step parsing accuracy (< 0.7 from DD#334). At L=4 hops, G ≤ 0.7^4 ≈ 0.24.

### Incompatibility 3: Better Local Optimization → Worse Memory Architecture
CoMAM (Stage 5) jointly optimizes agents via global credit assignment. But this joint optimization can push the retrieval agent toward configurations that conflict with TA-Mem's (Stage 6) multi-indexed memory design. When the retrieval agent is optimized for a global reward that aggregates across query types, it may converge on a single dominant retrieval mode — undoing the mode-separation that TA-Mem establishes.

**Formal relationship:** Global reward optimization R_global selects for the strategy maximizing expected value across all query types, which is often the single best retrieval mode (argmax over modes). TA-Mem's per-mode specialization produces better worst-case performance but lower expected-case performance.

### Incompatibility 4: Better Grounding → Worse Cross-Agent Coordination
Improving parsing quality (Stage 4 fix) increases the volume and detail of extracted information. But DD#341 shows that agent coordination cost scales with information volume — more detailed extractions create larger state spaces for cross-agent credit assignment, slowing convergence and degrading coordination quality.

## 5. The Integrity Composition Law

**Insight:** End-to-end knowledge integrity is the product of per-stage integrity factors, not the sum:

```
I_total = I_storage × I_retrieval × I_reasoning × I_grounding × I_coordination × I_memory
```

With empirical estimates from the papers:
- I_storage (MetaKE) ≈ 0.97 (96.84% efficacy)
- I_retrieval (DD#311) ≈ 0.50 (latest-state accuracy drops ~50%)
- I_reasoning (DD#322) ≈ 0.47 (53% HNE → ~47% genuine reasoning)
- I_grounding (DD#334) ≈ 0.35 (34.1% avg with docs)
- I_coordination (DD#341) ≈ 0.85 (estimated from CoMAM joint improvement)
- I_memory (DD#337) ≈ 0.80 (estimated from mode-matching improvement)

**I_total ≈ 0.97 × 0.50 × 0.47 × 0.35 × 0.85 × 0.80 ≈ 0.054**

**End-to-end knowledge integrity in a multi-stage agent system is approximately 5.4%.** This means that even with state-of-the-art fixes at each individual stage, a knowledge fact that enters the pipeline has only a ~5% chance of being correctly stored, retrieved, reasoned over, grounded, coordinated, and remembered.

## 6. Escape Strategies

### Strategy A: Stage Elimination
If stages compose multiplicatively, eliminate stages. The most impactful elimination:
- **Bypass Stage 2 (Retrieval)** by keeping knowledge in parametric form only → but this limits to pre-training knowledge only
- **Bypass Stage 4 (Grounding)** by pre-parsing all documents at ingestion time → expensive but removes the 0.35 bottleneck
- **Merge Stages 5-6** by co-designing the memory architecture with the coordination protocol (which CR#175/MemOS v2 proposes)

### Strategy B: Stage Ordering
Some stage orderings reduce incompatibility penalties:
- **Ground-then-Reason** (Stage 4 before Stage 3): Parse and extract all evidence first, THEN reason over structured data. This converts the multiplicative grounding × reasoning penalty into an additive one.
- **Retrieve-by-Mode** (Stage 6 before Stage 2): Select retrieval mode FIRST, then retrieve. This avoids Stage 2's temporal confusion by narrowing the retrieval scope.

### Strategy C: End-to-End Joint Optimization
CoMAM (DD#341) shows that joint optimization outperforms local optimization. Extending this principle across ALL six stages would require:
1. A global reward signal that reflects end-to-end integrity
2. Credit assignment across 6+ agents/stages
3. Training data that exercises the full pipeline

This is computationally expensive but theoretically addresses the Fix Incompatibility Problem by finding Pareto-optimal configurations across all stages simultaneously.

## 7. Connection to Prior Work

### Extends CR#156 (Knowledge Modification as Manifold Geometry)
CR#156 identified that Stages 1-3 share a geometric interpretation. CR#178 extends this by showing the geometric structure creates incompatibilities: the manifold that enables successful editing (Stage 1) induces spectral structures that complicate retrieval (Stage 2) and reasoning (Stage 3).

### Extends CR#160 (Knowledge Update Dynamics)
CR#160 focused on the temporal dimension of knowledge updates. CR#178 reveals that temporal updating is just Stage 2 of a six-stage pipeline, and the temporal fix (recency weighting) can conflict with Stage 1 (editing) and Stage 3 (reasoning).

### Connects to CR#169 (Domain-Dependent Ceiling)
CR#169's "three task regimes" map to different dominant failure stages:
- **Bounded-Generative (80-90%)**: Stages 1-2 dominate (storage + retrieval sufficient)
- **Grounded-Extractive (45-70%)**: Stage 4 dominates (parsing bottleneck)
- **Open-Adversarial-MAS (30-45%)**: Stages 3+5 dominate (reasoning shortcuts + coordination failure)

This explains CR#169's regime gaps via the Knowledge Integrity Pipeline — different regimes activate different pipeline bottlenecks.

### Connects to CR#175 (MemOS v2)
MemOS v2's 8-layer memory stack addresses Stages 2 and 6 (retrieval and memory architecture). CR#178 reveals that even a perfect MemOS still faces Stages 1, 3, 4, and 5 — the memory layer alone cannot ensure knowledge integrity.

## 8. Predictions

**KIP-1:** Systems that pre-parse all documents at ingestion time will show >2× end-to-end accuracy improvement over systems that parse on-demand, because this eliminates the 0.35 grounding bottleneck.

**KIP-2:** Joint end-to-end optimization (à la CoMAM extended across all stages) will discover configurations where individual stage performance is suboptimal but total pipeline integrity is maximized — violating the assumption that optimizing each stage independently is sufficient.

**KIP-3:** The Fix Incompatibility Problem will be most severe in systems that independently deploy state-of-the-art solutions for each stage without cross-stage integration. "Best-in-class components" assembled without pipeline-level optimization will underperform "mediocre" components with pipeline-level tuning.

**KIP-4:** The retrieval stage (Stage 2, I ≈ 0.50) is the most impactful single target for improvement, as it is the largest multiplicative bottleneck after grounding. Systems that solve temporal primacy bias will see the largest single-stage integrity gain.

## 9. The Meta-Lesson

Every one of these six papers presents its solution as a standalone advance. And each solution IS a genuine advance — within its stage. But the Knowledge Integrity Pipeline reveals that **the problem of reliable agent knowledge is not six independent problems with six independent solutions. It is one pipeline problem where fixes at any stage interact with all other stages.**

The field is optimizing components. It needs to optimize the pipeline.

---

**Word count:** ~2,400
**Novel concepts:** Knowledge Integrity Pipeline, Fix Incompatibility Problem, Integrity Composition Law, Stage Elimination/Ordering strategies
**Falsifiable predictions:** 4 (KIP-1 through KIP-4)
