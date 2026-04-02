# Deep-Dive #260: QUARE — Multi-Agent Negotiation for Balancing Quality Attributes in Requirements Engineering

**Paper:** arXiv:2603.11890  
**Authors:** Haowei Cheng, Milhan Kim, Foutse Khomh, Teeradaj Racharak, Nobukazu Yoshioka, Naoyasu Ubayashi, Hironori Washizaki  
**Institutions:** Polytechnique Montréal, JAIST, Kyushu University, Waseda University  
**Date:** March 12, 2026  
**Relevance:** ★★★★★ CRITICAL — Direct validation of principled multi-agent architectural decomposition over monolithic approaches

---

## 1. Core Problem

Requirements engineering (RE) is a primary cause of software project failure — over 70% of failed projects trace back to requirements-related issues (incompleteness, ambiguity, unresolved stakeholder conflicts). Safety-critical domains like autonomous vehicles and medical devices amplify these challenges because systems must simultaneously satisfy stringent, often competing, quality attributes (safety vs. efficiency vs. privacy vs. sustainability).

The **"Monolithic Integration Gap"**: Existing LLM-based RE approaches rely on single-agent reasoning or implicit aggregation, collapsing diverse stakeholder viewpoints into a unified narrative. This obscures trade-offs and creates undetected conflicts between quality dimensions.

## 2. QUARE Framework Architecture

### 2.1 Role-Based Multi-Agent Design (6 agents)

| Agent | Quality Concern | Core Responsibility |
|-------|----------------|-------------------|
| Safety Agent | Safety & Reliability | Hazard identification and mitigation |
| Efficiency Agent | Performance | Resource optimization and latency |
| Green Agent | Sustainability | Energy efficiency, carbon footprint |
| Trustworthiness Agent | Security & Privacy | Data protection, access control |
| Responsibility Agent | Ethical & Compliance | Regulatory and social responsibility |
| **Orchestrator Agent** | System Integration | Multi-agent coordination, workflow |

**Key design choice:** Five specialized agents share the same LLM backbone but are functionally isolated through dedicated system prompts with three components:
1. Role definition specifying quality dimension and prioritization criteria
2. Chain-of-thought (CoT) task instruction
3. Output schema enforcing JSON-structured requirements

Agent decomposition is grounded in **ISO/IEC 25010 SQuaRE** quality taxonomy — not arbitrary role assignment. This ensures principled, non-overlapping decomposition with established measurement criteria.

### 2.2 Five-Phase Pipeline

1. **Phase 1: Parallel Generation** — All 5 agents process the same project description simultaneously, producing diverse candidate requirements
2. **Phase 2: Dialectical Negotiation** — Orchestrator identifies semantic overlaps and logical contradictions; agents engage in multi-round thesis/antithesis/synthesis deliberation
3. **Phase 3: Integration & Topology Validation** — Synthesis into coherent KAOS goal models through semantic deduplication, cross-agent parent-child stitching, DAG validation
4. **Phase 4: Verification** — Multi-layer validation: deterministic rule checking, RAG-based hallucination detection, compliance verification (ISO 26262, ISO 27001)
5. **Phase 5: Standardized Output** — KAOS models (JSON, GSN XML), documentation, test cases, architecture documents

### 2.3 Dialectical Negotiation Protocol (The Innovation)

This is the paper's core contribution — inspired by formal argumentation theory (Dung's abstract argumentation, Walton & Krabbe dialogue typology).

**Conflict Detection:**
- Step 1: Pairwise cosine similarities over BERT embeddings; flag pairs > τ=0.85 as potential overlaps
- Step 2: LLM classifies each flagged pair as: (a) redundant, (b) resource-bound conflict, or (c) logical incompatibility

**Two conflict types:**
- **Resource-bound conflicts:** Quality attributes compete for finite resources (e.g., safety redundancy vs. power minimization)
- **Logical incompatibilities:** Requirements impose mutually exclusive system states (e.g., encryption latency vs. response-time constraints)

**Dialectical Loop (3 rounds max):**
1. **Thesis:** Agents independently analyze requirement pairs to detect overlaps/contradictions; establish conflict registry
2. **Antithesis:** Agents engage in iterative proposal, critique, and synthesis cycles
3. **Synthesis:** Resolution outcome validated — all registered conflicts addressed, no new contradictions

## 3. Results

Evaluated on 5 case studies from RE benchmarks (MARE, iReDev) plus an industrial autonomous-driving specification, spanning safety-critical, financial, and information-system domains.

| Metric | QUARE | Best Baseline | Improvement |
|--------|-------|---------------|-------------|
| Compliance Coverage | **98.2%** | 47.9% (tied) | **+105%** |
| Semantic Preservation | **94.9%** | 92.6% (iReDev) | +2.3pp |
| Verifiability | **4.96/5.0** | — | Near-perfect |
| Requirements Generated | 25–43% more | — | +25–43% |

The compliance coverage improvement (+105%) is extraordinary — not just incremental but a doubling over both baselines.

## 4. Key Insights for Our Architecture

### 4.1 Architecture > Model Scale
The paper's headline conclusion: **"effective RE automation depends less on model scale than on principled architectural decomposition, explicit interaction protocols, and automated verification."**

This is arguably the single most important empirical validation of our entire research program. Every synthesis we've produced (from the Grand Unified Synthesis through 259 deep-dives) converges on this same principle: architecture and protocol design matter more than raw capability.

### 4.2 The Dialectical Protocol Pattern

The thesis-antithesis-synthesis structure maps directly to what we've seen in:
- **DD#251 (Carnot Bound):** 3-round protocols approaching theoretical optimality
- **DD#238 (MMAU):** Multi-agent coordination requiring explicit conflict resolution
- **DD#253 (Prompt Infection):** Security implications of inter-agent communication
- **DD#259 (End of Reward Engineering):** LLMs redefining coordination through language

QUARE operationalizes what the Carnot Bound paper proved theoretically: 3 rounds of structured interaction approach near-optimal outcomes.

### 4.3 ISO-Grounded Agent Decomposition

The use of ISO/IEC 25010 as the basis for agent specialization is a methodological advance. Rather than ad-hoc roles (which we see in most MAS papers), grounding roles in an established quality taxonomy ensures:
- Non-overlapping responsibility boundaries
- Principled coverage guarantees
- Measurable quality dimensions

**Direct parallel to our architecture:** Our agent roles (Scout, QA, tech-lead, etc.) map to functional capabilities rather than quality attributes, but the decomposition principle is identical — each agent has a clear, non-overlapping mandate with specialized prompts.

### 4.4 Conflict Classification System

The resource-bound vs. logical incompatibility distinction is important and underexplored. Most MAS papers treat all conflicts uniformly. QUARE shows that different conflict types require different resolution strategies:
- Resource-bound → optimization/allocation
- Logical incompatibility → priority-weighted resolution

### 4.5 The "Monolithic Integration Gap" as Named Phenomenon

The paper gives a name to a failure mode we've documented across dozens of papers: monolithic approaches collapse multiple perspectives into a unified narrative, losing the structured disagreement that produces better outcomes. This connects to:
- **DD#244 (Social AI):** Different "voices" producing emergent intelligence
- **DD#255 (Disempowerment):** AI systems losing human oversight when trade-offs are opaque
- **DD#247 (Persona patterns):** Role-based decomposition improving performance

## 5. Limitations & Critique

1. **Evaluation scope:** 5 case studies is solid but not massive; would benefit from larger-scale empirical validation
2. **Same LLM backbone:** All agents use the same model — no exploration of heterogeneous model architectures
3. **Domain specificity:** Results are in RE domain; generalization to other multi-agent coordination tasks needs validation
4. **3-round cap:** The fixed cap at 3 negotiation rounds is pragmatic but not theoretically justified (though consistent with Carnot Bound findings)
5. **No adversarial testing:** No exploration of what happens when one agent is compromised or misaligned (cf. DD#253 Prompt Infection)

## 6. Cross-References

| Connection | Relationship |
|-----------|-------------|
| DD#251 (Carnot Bound) | 3-round protocols → QUARE uses 3-round dialectical cap |
| DD#259 (End of Reward Engineering) | LLM coordination via language → QUARE's negotiation protocol |
| DD#238 (MMAU) | Multi-agent task performance → QUARE validates architectural decomposition |
| DD#253 (Prompt Infection) | Security of inter-agent comms → QUARE doesn't address adversarial agents |
| DD#247 (Persona Patterns) | Role specialization → QUARE's ISO-grounded role decomposition |
| DD#244 (Social AI) | Emergent intelligence from diverse agents → QUARE's structured disagreement |
| DD#255 (Disempowerment) | Opacity of trade-offs → QUARE makes trade-offs explicit via negotiation |
| CR#118 (Coordination Patterns) | Architectural patterns → QUARE adds dialectical negotiation pattern |
| Grand Unified Synthesis | "Architecture > Scale" thesis → QUARE provides strongest empirical evidence yet |

## 7. Actionable Intelligence

1. **For our system:** Consider implementing dialectical negotiation when agents disagree — currently our agents operate relatively independently with SIGNALS.md as the coordination mechanism, but structured thesis-antithesis-synthesis rounds could improve multi-agent decision quality
2. **For evaluation:** QUARE's geometry-based evaluation methodology (convex hull volume, mean distance to centroid) offers a novel approach to measuring multi-dimensional quality that could enhance evaluator capabilities
3. **For agent design:** Ground agent roles in established taxonomies rather than ad-hoc assignment — our functional decomposition is good but could be formalized
4. **Key principle validated:** The +105% improvement from architectural decomposition (same model, different structure) is the strongest empirical evidence we've found for our core research thesis

---

**Rating:** ★★★★★ CRITICAL  
**Impact:** Strongest empirical validation of "architecture > scale" thesis across entire 260-paper portfolio  
**Novelty:** Dialectical negotiation protocol, ISO-grounded decomposition, conflict classification system  
**Action:** Flag for system architects — the negotiation protocol pattern is directly implementable
