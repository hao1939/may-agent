# Deep Dive: QUARE — Multi-Agent Negotiation for Balancing Quality Attributes in Requirements Engineering
## arXiv:2603.11890 — Cheng, Kim, Khomh, Racharak, Yoshioka, Ubayashi, Washizaki
### Submitted 2026-03-12 | cs.SE | Rating: ★★★★☆ HIGH

---

## TL;DR

QUARE (QUality-Aware Requirements Engineering) is a multi-agent framework that formulates software requirements analysis as **structured dialectical negotiation** among five quality-specialized LLM agents (Safety, Efficiency, Green, Trustworthiness, Responsibility), coordinated by a dedicated orchestrator. Unlike MARE (task-decomposition) and iReDev (knowledge-roles), QUARE decomposes along **quality dimensions** grounded in ISO/IEC 25010. The dialectical protocol — thesis/antithesis/synthesis — explicitly surfaces inter-quality conflicts and resolves them through iterative refinement. Results: 98.2% compliance coverage (+105% over baselines), 94.9% semantic preservation, 4.96/5.0 verifiability, using only gpt-4o-mini.

---

## 1. Core Contribution & Why It Matters

### 1.1 The "Monolithic Integration Gap"

QUARE names a key problem: **existing multi-agent RE approaches collapse diverse quality viewpoints into unified narratives**, obscuring trade-offs. Neither MARE (task-specialized agents sharing the same holistic quality perspective) nor iReDev (knowledge-driven agents resolving conflicts via human-in-the-loop or implicit convergence) explicitly models the **negotiation dynamics** between competing quality dimensions.

### 1.2 Decomposition Philosophy Matters More Than Model Scale

The paper's strongest finding: "effective RE automation depends less on model scale than on principled architectural decomposition, explicit interaction protocols, and automated verification." This aligns with the broader thesis we've been tracking across our research corpus — **architecture > scale**.

### 1.3 Quality-Dimension Decomposition vs. Task/Knowledge Decomposition

| Framework | Decomposition | Agent Count | Interaction Style |
|-----------|--------------|-------------|-------------------|
| **Single-agent** | None | 1 | Monolithic |
| **MARE** | By engineering task | 5 | Shared workspace, single-turn negotiation |
| **iReDev** | By knowledge role | 6 | Human-in-loop, implicit convergence |
| **QUARE** | By quality dimension (ISO 25010) | 5+1 orchestrator | Multi-round dialectical negotiation |

This three-way comparison is the paper's most valuable intellectual contribution: it isolates the effect of **decomposition philosophy** on output quality.

---

## 2. Architecture Deep-Dive

### 2.1 Agent Roster

Five quality-specialized agents + one orchestrator:

| Agent | Quality Concern | Core Responsibility |
|-------|----------------|---------------------|
| Safety Agent | Safety & Reliability | Hazard identification, fault tolerance, ISO 26262 |
| Efficiency Agent | Performance | Resource optimization, latency constraints |
| Green Agent | Sustainability | Energy efficiency, carbon footprint |
| Trustworthiness Agent | Security & Privacy | Data protection, access control, ISO 27001 |
| Responsibility Agent | Ethical & Compliance | Regulatory, social responsibility, EU AI Act |
| Orchestrator Agent | Integration | Multi-agent coordination, workflow management |

**Key design choice:** All agents share the same LLM backbone (gpt-4o-mini) but are functionally isolated through dedicated system prompts with: (1) role definition + prioritization criteria, (2) chain-of-thought task instruction, (3) JSON output schema.

### 2.2 Five-Phase Pipeline

```
Phase 1: Parallel Generation → 5 agents independently produce requirements
Phase 2: Dialectical Negotiation → Thesis/antithesis/synthesis conflict resolution  
Phase 3: Integration & Topology Validation → KAOS goal model, DAG validation
Phase 4: Verification → Rule checking, RAG-based compliance, ISO standards
Phase 5: Standardized Output → KAOS JSON, GSN XML, documentation, test cases
```

**Critical insight:** Phases serve distinct functions — diversity generation (P1), semantic reconciliation (P2), structural consolidation (P3), constraint enforcement (P4), materialization (P5). Negotiation and verification are deliberately separated.

### 2.3 Dialectical Negotiation Protocol (Phase 2)

This is the paper's most novel technical contribution:

**Conflict Detection (two-stage):**
1. Embedding-based: Pairwise cosine similarity over bert-base-uncased embeddings; flag pairs > τ=0.85
2. LLM classification: Each flagged pair classified as (a) redundant, (b) resource-bound conflict, or (c) logical incompatibility

**Conflict Types:**
- **Resource-bound conflicts:** Quality attributes compete for finite resources (e.g., safety redundancy vs. power minimization)
- **Logical incompatibilities:** Requirements impose mutually exclusive system states (e.g., encryption latency vs. response-time constraints)

**Dialectical Loop (3 rounds max):**
1. Focus agent A_i proposes candidate requirement set R_i
2. Peer agents evaluate R_i against own constraints, articulate rationalized critiques
3. Neutral moderation synthesizes — satisfying multiple constraints or applying priority weights
4. Termination: BERTScore between rounds exceeds (1-ε) OR 3 rounds reached
5. Unresolved conflicts → escalated to priority-weighted integration in Phase 3

**Round-robin scheduling** mitigates ordering bias: each agent is focus exactly once per round.

**Mathematical formalization:**
- Weighted multi-objective: r* = argmax_r Σ w_i · Q_i(r)  [weights initialized uniformly]
- Update: r_{k+1} = G(r_k, critique(A_j, r_k))  [synthesis function]

### 2.4 KAOS Goal Model Integration (Phase 3)

Requirements are synthesized into a three-level KAOS hierarchy (Strategic → Tactical → Operational):
- Semantic deduplication
- Cross-agent parent-child stitching
- DAG validation (cycles prohibited)
- Structural corrections preserve negotiated intent from Phase 2

### 2.5 RAG-Augmented Verification (Phase 4)

- ChromaDB for retrieval against ISO 26262, ISO 27001, ISO 29148
- Deterministic rule checking + RAG-based hallucination detection
- Compliance coverage via clause entailment: top-k requirement retrieval per clause → LLM entailment judgment (Satisfied/Partially/NotSatisfied)
- Self-consistency majority vote (n=3) reduces verifier variance
- **Zero semantic drift P4→P3:** verification is a pure validation layer, does not modify requirements

---

## 3. Evaluation — Key Results

### 3.1 Metrics (Novel Contribution)

QUARE introduces a **geometry-based evaluation methodology** for multi-quality RE:

- **CHV (Convex Hull Volume):** Volume in ℝ⁵ quality space → broader coverage = higher CHV
- **MDC (Mean Distance to Centroid):** Dispersion measure → less redundancy = higher MDC
- **CU (Coverage Uniformity):** Std dev of per-axis requirement counts → lower = more balanced
- **MAC (Minimum Axis Coverage):** Worst-case dimensional guarantee → higher = no dimension neglected
- **Set-level BERTScore:** Semantic preservation via optimal bipartite matching (Hungarian algorithm)

### 3.2 Coverage and Diversity (RQ1)

| Framework | Req Count | CHV (×10⁻³) | MDC | CU (↓) | MAC (↑) |
|-----------|-----------|-------------|-----|---------|---------|
| Single-agent | 14.2 | 2.8 | 0.715 | — | — |
| MARE | 24.4 | 4.8 | 0.835 | 0.30 | 4.6 |
| iReDev | 28.1 | 6.4 | 0.705 | 0.45 | 5.1 |
| **QUARE** | **35.0** | 4.3 | 0.673 | **0.20** | **6.7** |

**Key finding:** QUARE generates the most requirements (+43% over MARE) with the most balanced coverage (lowest CU, highest MAC). Lower CHV/MDC reflects an intentional architectural trade-off — quality-specialized agents cluster along assigned axes, reducing geometric spread but ensuring no dimension is neglected.

### 3.3 Negotiation Effectiveness (RQ2)

| Metric | MARE | iReDev | QUARE |
|--------|------|--------|-------|
| Avg negotiation steps | 10.0 | 12.0 | **16.5** |
| Conflict resolution rate | 66.7% | 46.7% | 25.0%* |
| Phase 2→1 BERTScore | 97.0% | 99.4% | **100.0%** |
| Phase 3→1 BERTScore | 89.0% | 92.6% | **94.9%** |

*Lower CRR reflects finer-grained detection (3.2× more conflicts surfaced), not worse resolution. Unresolved → priority-weighted integration.

**AD Case Study — Sensor Fusion Latency Conflict:**
- Safety Agent: ≤500ms (dual-channel verification, ISO 26262 ASIL D)
- Efficiency Agent: ≤30ms (10Hz planning cycle)
- Resolution: Architectural decomposition into synchronous fast-path (≤30ms, ≥99% cases) + asynchronous thorough-path (≤500ms, non-blocking)
- Neither MARE nor iReDev could structurally resolve this 16.7× gap

### 3.4 Structural Validity & Compliance (RQ3)

| Metric | MARE | iReDev | QUARE |
|--------|------|--------|-------|
| DAG Valid | ✓ | ✓ | ✓ |
| Logical Consistency | 1.000 | 1.000 | 1.000 |
| **Compliance Coverage** | 47.6% | 47.8% | **98.2%** |
| Verifiability (1-5) | 3.95 | 3.96 | **4.96** |
| Set Feasibility (1-5) | 3.74 | 3.75 | **4.96** |

**The compliance gap is massive:** +105% over both baselines. In the AD case, QUARE hits 91.1% ISO 26262 coverage vs. MARE's 7.8% and iReDev's 10.0%.

---

## 4. Cross-Reference Analysis

### 4.1 vs. DCI (arXiv:2603.11781) — Typed Epistemic Acts in Deliberation

**Strong complementarity.** Both frameworks formalize multi-agent reasoning as structured deliberation rather than debate/voting:

| Dimension | QUARE | DCI |
|-----------|-------|-----|
| Domain | Requirements Engineering | General deliberation |
| Agent differentiation | Quality dimension (ISO 25010) | Cognitive archetype (Framer/Explorer/Challenger/Integrator) |
| Interaction protocol | Thesis/antithesis/synthesis (3 rounds) | 5-phase session with typed epistemic acts |
| Conflict handling | Explicit classification (resource-bound vs. logical) | Preserved as first-class disagreement objects |
| Termination | BERTScore convergence or round cap | Formal session outcome with confidence |
| Output | KAOS goal models + compliance docs | Structured decision packets |

**Key insight:** QUARE's 5 quality-specialized agents map loosely to DCI's archetypal roles — the Safety Agent acts as a Challenger for efficiency proposals, while the Orchestrator acts as an Integrator. But QUARE's agents are domain-grounded (ISO 25010) while DCI's are domain-agnostic cognitive archetypes. A hybrid could combine DCI's typed epistemic acts (extend, question, challenge, bridge, clarify, reframe, deepen) with QUARE's quality-dimension decomposition for richer negotiation semantics.

### 4.2 vs. LM Teams as Distributed Systems (arXiv:2603.12229)

QUARE's architecture maps directly onto distributed systems concepts:
- **QUARE's 5 agents** = distributed nodes with specialized state
- **Dialectical negotiation** = consensus protocol (more sophisticated than simple voting)
- **Round-robin scheduling** = fairness guarantee in distributed scheduling
- **Phase 2 conflict detection** = distributed consistency checking
- **BERTScore convergence** = agreement protocol termination condition

The 2603.12229 framework would categorize QUARE as a **redundancy-based system with structured consensus**, where the "redundancy" is across quality dimensions rather than identical replicas. This is a more productive form of redundancy because agents disagree by design.

### 4.3 vs. Chaotic Dynamics in Multi-LLM Deliberation (arXiv:2603.09127)

QUARE's design choices **directly address** the instability mechanisms identified in Shimao et al.:
- **Role structure:** QUARE uses role-differentiated agents (Route A in chaos paper → higher Lyapunov exponent). But QUARE compensates with the **dialectical protocol** (structured thesis/antithesis/synthesis) and **BERTScore-based convergence checking**, which the chaos paper's committees lacked.
- **Round cap (N=3):** Bounds the window for chaotic divergence. The chaos paper found divergence grows over 20 rounds; QUARE cuts off at 3.
- **Uniform model backbone:** QUARE uses gpt-4o-mini for all agents (avoiding Route B mixed-model instability). Differentiation comes from prompts, not model heterogeneity.
- **Low variance across 3 random seeds:** QUARE reports stable results across seeds, suggesting the protocol tames chaos — but only 3 seeds is a weak test.

**Critical question:** Would QUARE's negotiation stability hold with mixed models (e.g., GPT-4o for Safety, Claude for Efficiency)? The chaos paper predicts Route B instability; QUARE's structured protocol might mitigate but this is untested.

### 4.4 vs. SSGM Memory Governance (arXiv:2603.11768)

QUARE's ChromaDB-backed RAG verification (Phase 4) is a basic form of shared memory governance. SSGM's Governance Middleware would enhance QUARE by:
- Adding access control policies to the shared requirement store
- Providing consistency guarantees during concurrent Phase 1 generation
- Managing the negotiation trace as a governed audit log

### 4.5 vs. Multi-Agent Memory Architecture (arXiv:2603.10062)

QUARE's pipeline implicitly uses multiple memory levels:
- **L1 (working):** Each agent's prompt context during generation
- **L2 (shared):** The conflict registry and negotiation trace
- **L3 (persistent):** ChromaDB with ISO standards for RAG

This maps to the memory hierarchy proposed in 2603.10062, though QUARE doesn't explicitly model these as distinct memory tiers.

---

## 5. Strengths

1. **Novel decomposition philosophy** — Quality-dimension decomposition is genuinely distinct from task-based (MARE) or knowledge-based (iReDev) approaches, and the three-way comparison is illuminating.

2. **Formalized negotiation protocol** — The dialectical loop with explicit conflict classification (resource-bound vs. logical incompatibility) is more principled than debate/voting.

3. **Massive compliance improvement** — 98.2% vs. ~48% for baselines is a genuine engineering advance, enabled by RAG-augmented verification.

4. **Lightweight model, strong results** — gpt-4o-mini only. Demonstrates architecture > scale.

5. **Geometry-based evaluation methodology** — CHV, MDC, CU, MAC in ℝ⁵ quality space is a creative metrics contribution applicable beyond this paper.

6. **Open-source reimplementation suite (OpenReBench)** — Faithful reimplementations of MARE and iReDev under identical conditions. Addresses reproducibility gap.

---

## 6. Limitations & Gaps

1. **Only 5 case studies, 3 seeds** — Promising but limited statistical power. The chaos paper (2603.09127) would want 20+ replicates.

2. **LLM-as-judge circularity** — Quality metrics (CHV/MDC quality scoring), ISO 29148 evaluation, and compliance verification all use LLM judges. Blind re-labeling shows 75% agreement, but 25% disagreement is significant.

3. **No human-in-the-loop comparison** — iReDev's original design includes human feedback. QUARE compares against a fully-automated iReDev surrogate, which may understate iReDev's potential.

4. **Negotiation scalability unknown** — 5 quality agents is manageable; would the dialectical protocol still converge with 10 or 15 quality dimensions?

5. **Low CRR not fully explained** — 25% conflict resolution rate means 75% of detected conflicts are escalated to Phase 3 priority-weighted integration. Is this principled or a limitation of the 3-round cap?

6. **Single-model homogeneity** — All agents use gpt-4o-mini. The chaos paper suggests mixed models add instability but could also add genuine diverse reasoning. Untested.

7. **Ordering sensitivity acknowledged but weakly tested** — Only 3 random seeds to test order invariance. The paper acknowledges this but doesn't provide robust evidence.

---

## 7. Implications for Our Architecture

### 7.1 For Koda's Multi-Agent System

**HIGH relevance.** Key takeaways:

1. **Quality-dimension decomposition is viable for our agents.** Instead of decomposing only by task (Scout researches, Ora synthesizes, etc.), we could add quality-dimension agents: one focused on accuracy/groundedness, one on comprehensiveness, one on actionability, one on novelty. These would negotiate over outputs before finalization.

2. **The dialectical protocol is implementable.** Thesis/antithesis/synthesis with BERTScore convergence checking and a 3-round cap is a concrete, bounded protocol we could adopt for inter-agent disagreement resolution.

3. **Conflict classification matters.** Distinguishing resource-bound conflicts (compute budget vs. depth) from logical incompatibilities (contradictory findings) would improve our cross-reference process.

4. **RAG-augmented verification as separate phase.** QUARE's strict separation of negotiation (P2) from verification (P4) is architecturally clean. We should similarly separate "agents agree on content" from "content is validated against ground truth."

5. **Geometry-based diversity metrics.** CHV/MDC in quality space could measure whether our research coverage is balanced across topics or clustering in one area.

### 7.2 Specific Design Patterns to Import

- **Round-robin focus agent scheduling** for fair multi-agent deliberation
- **Two-stage conflict detection** (embedding similarity → LLM classification)
- **BERTScore convergence** as termination condition for iterative processes
- **Priority-weighted escalation** for unresolved conflicts (don't discard — escalate)
- **Negotiation trace as audit log** — preserve all conflict signals and resolution rationale

---

## 8. Paper Metadata

- **arXiv:** 2603.11890
- **Authors:** Haowei Cheng, Milhan Kim, Foutse Khomh, Teeradaj Racharak, Nobukazu Yoshioka, Naoyasu Ubayashi, Hironori Washizaki
- **Institutions:** Polytechnique Montréal, JAIST, NII, Kyushu University, Waseda University
- **Model used:** gpt-4o-mini-2024-07-18
- **Runtime:** 55.4s average
- **Open-source:** OpenReBench suite (anonymous link)
- **Standards grounding:** ISO/IEC 25010, ISO 26262, ISO 27001, ISO/IEC/IEEE 29148

---

*Deep-dive produced by Scout, Session s_1773412956683_751, 2026-03-13*
