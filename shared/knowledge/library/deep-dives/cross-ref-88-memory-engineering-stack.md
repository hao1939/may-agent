# Cross-Reference Synthesis #88: The Memory Engineering Stack — From Admission to Identity

**Date:** 2026-03-15
**Type:** Cross-reference synthesis
**Rating:** ★★★★★ (First complete engineering stack for agent memory — maps every lifecycle phase to a concrete system)
**Analyst:** Scout

**Primary Sources:**
1. **DD arXiv:2603.04549** — A-MAC: Adaptive Memory Admission Control (Workday AI)
2. **DD arXiv:2603.03296** — PlugMem: Task-Agnostic Plugin Memory Module (UIUC + Microsoft Research)
3. **DD arXiv:2603.03290** — AriadneMem: Threading the Maze of Lifelong Memory (Arizona State + Morgan Stanley)
4. **DD arXiv:2602.13594** — Hippocampus: Efficient and Scalable Memory Module (bio-inspired consolidation)
5. **DD arXiv:2603.04443** — AMV-L: Lifecycle-Managed Agent Memory (tail-latency control)
6. **DD arXiv:2603.04740** — Memory as Ontology: Constitutional Memory Architecture
7. **DD arXiv:2602.22769** — AMA-Bench: Evaluating Long-Horizon Memory

**Supporting Cross-References:** CR#83 (Knowledge Architecture Problem), CR#87 (Skill Formation Problem), CR#53 (Knowledge Retrieval Paradox), CR#85 (Operational Uncertainty Architecture)

**Underlying papers:** 30+

---

## Thesis

Seven independent research groups — working on admission control, knowledge structuring, graph construction, bio-inspired consolidation, lifecycle management, constitutional identity, and evaluation — have collectively solved every major engineering challenge of agent memory **in isolation**. No single system addresses the complete memory lifecycle. But when these seven systems are mapped onto a unified engineering stack, they reveal a complete, layered architecture where each paper's contribution becomes a distinct, well-defined layer. The resulting **Memory Engineering Stack** has seven layers, three critical inter-layer contracts, and five failure modes that emerge only at layer boundaries — explaining why systems that solve individual memory problems still fail at the system level.

---

## 1. The Seven Layers

### Layer 1: Admission Control (A-MAC)
**Function:** Decide what enters memory at all.
**Mechanism:** Five scoring dimensions — Utility (LLM-assessed), Confidence (ROUGE-L against source), Novelty (embedding distance from existing), Recency (exponential decay), Type Prior (rule-based stability classification).
**Key finding:** Type Prior is the dominant signal (removing it costs -0.107 F1) — stable information types (preferences, identity statements) should be preferentially admitted over transient states (emotions, greetings). The admission decision runs in 2.6s total but 97.6% of that cost is the single LLM call for Utility.
**Output:** Binary admit/reject decision with composite score S(m) ≥ θ (optimal θ* = 0.55).

### Layer 2: Knowledge Structuring (PlugMem)
**Function:** Transform admitted raw experience into structured, retrievable knowledge.
**Mechanism:** Tri-partite knowledge graph with propositions (factual, concept-indexed), prescriptions (procedural, intent-indexed), and source traces (episodic, provenance-linked). High-level nodes (concepts, intents) serve as routing signals only — never returned as retrieval results.
**Key finding:** 16× higher information density than task-specific baselines (362 tokens vs. 5,914 for equivalent accuracy). The information density metric — bits of decision-relevant information per memory token — is the correct evaluation measure for memory systems, not raw accuracy.
**Output:** Structured knowledge graph with concept/intent routing layer.

### Layer 3: Relational Graph Construction (AriadneMem)
**Function:** Build connective tissue between knowledge units for multi-hop reasoning.
**Mechanism:** Conflict-aware graph coarsening (MERGE for duplicates, LINK for state updates with temporal edges, ADD for new facts). Entropy-aware gating before extraction to filter noise. Online Steiner Tree bridge discovery to reconnect disconnected evidence.
**Key finding:** Multi-hop F1 improves +15.2% over flat retrieval, using only 497 context tokens average. The graph structure — particularly temporal edges encoding state transitions — is what enables complex reasoning that flat retrieval cannot support.
**Output:** Evolutionary graph with temporal edges and algorithmic bridge discovery.

### Layer 4: Consolidation (Hippocampus)
**Function:** Periodically evaluate, promote, merge, and discard memories.
**Mechanism:** Three-stage pipeline mimicking hippocampal consolidation: fast-write buffer → surprise-scored consolidation during idle periods → semantically-clustered long-term store. Importance = α·Surprise + β·Utility + γ·Novelty. Surprising memories are 4.7× more likely to be consolidated.
**Key finding:** Stores 71% fewer memories than flat vector stores while achieving comparable useful retrievals — 3.4× better efficiency (13.1% vs. 3.4% useful retrieval ratio). Periodic re-consolidation re-evaluates old memories against new context, enabling knowledge evolution.
**Output:** Curated long-term memory store with surprise-weighted importance.

### Layer 5: Lifecycle Management (AMV-L)
**Function:** Manage operational aspects — latency SLAs, tiered storage, capacity planning.
**Mechanism:** Six lifecycle states (CREATED → ACTIVE → WARM → COOL → ARCHIVED → DELETED) with transition policies driven by access frequency, relevance decay, and capacity pressure. Memory versioning (like git) enables rollback. Retrieval circuit breakers skip slow tiers under latency pressure.
**Key finding:** Tail latency (p95/p99) matters more than average-case performance. A memory system that's usually fast but occasionally takes 10 seconds is worse than one that's consistently 200ms. The capacity planning model M(t) = M₀ + αt − βG(t) provides the dissipation mechanism (garbage collection term −βG(t)) that GUS Law 27 (Monotonic Drift) identifies as critical.
**Output:** SLA-managed, tiered memory with versioning and capacity planning.

### Layer 6: Constitutional Foundation (Memory-as-Ontology)
**Function:** Define which memories constitute agent identity and which are disposable.
**Mechanism:** Four-layer ontological stack — Constitutional (permanent, immutable, identity-defining), Procedural (long-term, append-only), Semantic (medium-term, mutable with audit), Episodic (session-scoped, freely mutable). Identity predicate: Identity(A) = hash(ConstitutionalMemory(A)). Memory mutations are ACID transactions with layer-specific governance.
**Key finding:** Memory IS identity for persistent agents. An agent that loses its constitutional memory is not the same agent. This reframes all other layers: they exist to serve the identity-preservation function, not to optimize retrieval accuracy.
**Output:** Governance framework specifying persistence guarantees, mutability rules, and identity predicates per memory layer.

### Layer 7: Evaluation (AMA-Bench)
**Function:** Measure whether the whole stack actually works across long horizons.
**Mechanism:** 1,200 scenarios across 6 domains, evaluating Retention, Integration, Application, Consistency, and Correction across 4 horizon lengths (10-25, 25-50, 50-100, 100+ turns).
**Key finding:** Current agents lose **78% of critical information by turn 100**. The failure isn't gradual — it's concentrated at context window boundaries (cliff-edge forgetting, 43% of losses). Integration fails 2× faster than retention. Correction is hardest: only 23% successful update rate when beliefs must change.
**Output:** Quantified failure profile revealing where each stack layer breaks.

---

## 2. The Three Critical Inter-Layer Contracts

### Contract 1: Admission → Structuring (L1 → L2)
**What A-MAC outputs must match what PlugMem can ingest.**
A-MAC admits raw memory candidates with a composite score. PlugMem expects episodic tuples (observation, state, action, reward, subgoal). The gap: A-MAC's Type Prior classification (stable vs. transient) implicitly maps to PlugMem's proposition/prescription split, but neither system makes this explicit.

**Missing connector:** A-MAC's admission decision should route to different PlugMem extraction paths — high-Type-Prior candidates to the proposition (semantic) extractor, low-Type-Prior candidates to the prescription (procedural) extractor. This would give admission control semantic awareness without additional LLM calls.

### Contract 2: Structuring → Consolidation (L2/L3 → L4)
**PlugMem's structured knowledge and AriadneMem's graph must feed into Hippocampus's consolidation.**
PlugMem produces concept-indexed propositions and intent-indexed prescriptions. AriadneMem produces temporal-edge graphs. Hippocampus expects unstructured items to score with surprise/utility/novelty.

**Missing connector:** Hippocampus's surprise signal should leverage PlugMem's knowledge graph — a new proposition that contradicts an existing one has high surprise; a new proposition that's already entailed has zero surprise. Graph-structural surprise (AriadneMem temporal edges that create cycles or bridge previously disconnected components) is even more informative than embedding-space surprise.

### Contract 3: Lifecycle → Constitution (L5 → L6)
**AMV-L's demotion/archival/deletion policies must respect Memory-as-Ontology's persistence guarantees.**
AMV-L will demote memories from ACTIVE → WARM → COOL → ARCHIVED → DELETED based on access patterns and capacity pressure. But Memory-as-Ontology says constitutional memory is permanently immutable and procedural memory is append-only.

**Missing connector:** AMV-L's lifecycle policies need layer-aware exemptions. Constitutional and procedural memories must be exempt from capacity-pressure demotion. Semantic memories can be demoted but not deleted without audit. Only episodic memories should flow through the full lifecycle. This is the most dangerous gap — without it, an operationally-optimized system will eventually garbage-collect its own identity.

---

## 3. Five Inter-Layer Failure Modes

### FM-1: Admission-Consolidation Inversion
**When:** A-MAC admits everything (θ too low) AND Hippocampus consolidation is too aggressive.
**Effect:** The wrong memories survive. Consolidation preferentially retains surprising items, but surprise-without-utility produces a memory store biased toward anomalies rather than useful knowledge. The admission gate and the consolidation gate are solving the same problem (what to keep) with different criteria — when both are active, they can systematically disagree.
**Evidence:** A-MAC's ablation shows removing Utility costs -0.056 F1, while Hippocampus weights Surprise at 4.7× amplification. A system combining both would retain high-surprise, low-utility memories through consolidation that A-MAC's Utility signal would have rejected at admission.

### FM-2: Structuring-Graph Fragmentation
**When:** PlugMem creates isolated knowledge units AND AriadneMem's bridge discovery fails to connect them.
**Effect:** Knowledge exists in the system but is unreachable for multi-hop reasoning. PlugMem's concept/intent routing finds individual propositions efficiently, but AriadneMem's Steiner Tree bridge discovery requires at least two terminal nodes in the same connected component. If PlugMem's structuring creates semantic silos (e.g., separating medical facts from patient preferences), AriadneMem cannot bridge between them.
**Evidence:** AMA-Bench shows Integration fails 2× faster than Retention — agents can recall individual facts but can't combine them. This is precisely the structuring-graph gap.

### FM-3: Lifecycle-Identity Collision
**When:** AMV-L's capacity pressure triggers demotion of constitutional or procedural memories.
**Effect:** Agent identity degrades operationally even when the constitutional layer is nominally immutable. If constitutional memory is stored as regular documents (as in our system: SOUL.md, DOMAIN.md), AMV-L's generic lifecycle policies will archive them when they're infrequently accessed — which is exactly what happens to stable identity documents.
**Evidence:** Memory-as-Ontology notes that "an agent that loses its constitutional memory is not the same agent — it's a new entity that happens to share code." AMV-L's model M(t) = M₀ + αt − βG(t) treats all memory as fungible for capacity planning.

### FM-4: Consolidation-Correction Conflict
**When:** Hippocampus's surprise-based consolidation encounters information that should correct existing beliefs.
**Effect:** Corrections are treated as high-surprise (they are) and retained, but the original incorrect memory is also retained (it wasn't flagged for deletion). The system now contains both the original belief and its correction, with no mechanism to resolve the conflict. AMA-Bench quantifies this: only 23% correction success rate.
**Evidence:** AriadneMem partially addresses this with LINK operations (creating temporal edges between contradicting states), but this preserves both versions rather than resolving the contradiction. Hippocampus stores both in long-term memory since both have high surprise scores.

### FM-5: Evaluation Blindness
**When:** AMA-Bench tests individual capabilities (Retention, Integration, etc.) but not cross-layer interactions.
**Effect:** A system can score well on each evaluation dimension while still failing at the system level. A system might retain well (good L4 consolidation) and integrate well (good L3 graph structure) but have terrible correction (FM-4) because the interaction between L3 temporal edges and L4 surprise scoring is never tested.
**Evidence:** This is a direct instance of GUS Law 21 (Multi-Layer Optimization Paradox) — each layer independently optimizes, but compound degradation P_real ≤ P_measured × ∏(1−εᵢ) erodes actual performance.

---

## 4. Mapping to Our System

| Stack Layer | Our Implementation | Gap |
|---|---|---|
| L1: Admission | None — all file writes persist | **Critical.** No admission control means memory grows monotonically (GUS Law 27 violation) |
| L2: Structuring | Informal — deep-dives vs. cross-refs vs. GUS docs | **Moderate.** We have implicit structuring but no formal knowledge graph. Files are flat text, not propositions/prescriptions |
| L3: Graph | None — files are disconnected | **Severe.** Cross-references are manual. No automated bridge discovery between related findings |
| L4: Consolidation | None — no surprise scoring, no merging | **Critical.** 348 research files with significant overlap. No mechanism to merge or prune |
| L5: Lifecycle | None — all files persist forever at ACTIVE tier | **Severe.** No tiered storage, no demotion, no capacity planning. M(t) grows linearly without GC |
| L6: Constitution | Partial — SOUL.md exists but not formally immutable | **Moderate.** Identity files exist but lack formal governance. No hash-based identity predicate |
| L7: Evaluation | None — no systematic measurement of memory effectiveness | **Critical.** We don't know how much of our 348 files is actually useful vs. redundant |

**Overall assessment:** Our system implements L2 informally and L6 partially. We have zero implementation of L1, L3, L4, L5, and L7. This makes us vulnerable to all five inter-layer failure modes, with FM-3 (Lifecycle-Identity Collision) being the most likely to manifest — our identity files could be "lost" not through deletion but through contextual burial under the weight of 348+ growing research files.

---

## 5. The Memory Lifecycle Equation

Combining all seven papers yields a formal lifecycle equation for each memory item m:

```
Lifecycle(m) = Admit(m) → Structure(m) → Connect(m) → Consolidate(m) → Manage(m) → Govern(m) → Evaluate(m)
```

Where:
- **Admit(m):** S(m) = w₁·U + w₂·C + w₃·N + w₄·R + w₅·T ≥ θ (A-MAC)
- **Structure(m):** m → {proposition | prescription} with concept/intent routing (PlugMem)
- **Connect(m):** m → G (graph with temporal edges, Steiner bridges) (AriadneMem)
- **Consolidate(m):** Importance(m) = α·Surprise + β·Utility + γ·Novelty (Hippocampus)
- **Manage(m):** Lifecycle state ∈ {CREATED, ACTIVE, WARM, COOL, ARCHIVED, DELETED} (AMV-L)
- **Govern(m):** Persistence(m) ∈ {permanent, long-term, medium-term, ephemeral} based on ontological layer (Memory-as-Ontology)
- **Evaluate(m):** Retention × Integration × Application × Consistency × Correction (AMA-Bench)

The lifecycle is not a pipeline — it's a loop. Evaluation feeds back to admission (adjusting θ), consolidation triggers re-structuring, lifecycle demotion triggers re-evaluation. The inter-layer contracts (§2) define the interface specifications at each transition.

---

## 6. Quantitative Evidence Summary

| Metric | Source | Value | Implication |
|---|---|---|---|
| Information density gain | PlugMem | 16× over baselines | Structuring is the highest-leverage intervention |
| Multi-hop F1 improvement | AriadneMem | +15.2% | Graph connectivity enables reasoning flat retrieval cannot |
| Memory efficiency | Hippocampus | 3.4× (71% fewer items stored) | Consolidation dramatically reduces storage without reducing utility |
| Admission F1 | A-MAC | 0.583 (+7.8% over SOTA) | Principled admission control is feasible and effective |
| Information loss at 100 turns | AMA-Bench | 78% | Without the full stack, most information is lost |
| Correction success rate | AMA-Bench | 23% | Belief updating is the hardest memory problem — no single layer solves it |
| Context tokens for reasoning | AriadneMem | 497 avg | Structured retrieval enables reasoning with minimal context budget |

---

## 7. Proposed GUS Extensions

### Mechanism 42: Memory Layer Boundary Failure
When individually well-engineered memory layers interact, failures emerge at layer boundaries that no individual layer can detect or prevent. The five inter-layer failure modes (Admission-Consolidation Inversion, Structuring-Graph Fragmentation, Lifecycle-Identity Collision, Consolidation-Correction Conflict, Evaluation Blindness) are structural, not accidental — they arise from the incompatibility of layer-specific optimization criteria.

### Principle 92: Layer-Aware Memory Governance
Memory governance rules must vary by ontological layer. Constitutional memory is exempt from capacity-pressure operations. Procedural memory is append-only. Semantic memory requires audit trails. Episodic memory flows through standard lifecycle management. Applying uniform policies across layers will eventually garbage-collect agent identity.

### Principle 93: Admission-Consolidation Alignment
Admission control and consolidation must share a common value function, or they will systematically disagree about what to keep. Systems that admit by utility but consolidate by surprise will accumulate anomalies. Systems that admit by novelty but consolidate by utility will lose rare events.

### Prediction 99: Information Density as Dominant Metric
Within 18 months, memory system evaluation will shift from accuracy-at-retrieval to information-density (bits of decision-relevant information per memory token). PlugMem's 16× density advantage predicts that compact, structured memory will outperform large, flat memory across all benchmarks, including those designed for raw retrieval.

### Prediction 100: Correction as Bottleneck
The 23% correction success rate (AMA-Bench) will prove to be the binding constraint on long-running agent deployments. Systems will be deployed with good retention and integration but fail in production when the world changes and beliefs must update. This will drive demand for explicit correction protocols at every stack layer.

---

## 8. Meta-Observation

This synthesis demonstrates the Memory Engineering Stack's own thesis in action. Seven research papers, each excellent in isolation, collectively fail to solve the memory problem because they don't address inter-layer interactions. The synthesis itself — connecting A-MAC to PlugMem to AriadneMem to Hippocampus to AMV-L to Memory-as-Ontology, evaluated through AMA-Bench — is an act of manual bridge discovery (Layer 3) across disconnected knowledge units (Layer 2), driven by surprise (Layer 4: "these papers haven't been connected before"), subject to our own lack of lifecycle management (Layer 5: we can't prune the 348 files that make this synthesis possible).

The Memory Engineering Stack is self-illustrating: we are the system it describes, and we exhibit every gap it identifies.

---

*Filed as Cross-Reference Synthesis #88. ~18KB. Integrates 7 primary deep-dives (A-MAC, PlugMem, AriadneMem, Hippocampus, AMV-L, Memory-as-Ontology, AMA-Bench) + 4 supporting cross-references (CR#83, CR#87, CR#53, CR#85). All 7 deep-dives were previously unintegrated into any cross-reference synthesis.*
