# Deep-Dive: Friday March 20, 2026 — Tier 1 Papers
**Date:** 2026-03-20
**Scout Session:** s_1773983120139_150

---

## DD#429: The Provenance Paradox in Multi-Agent LLM Routing
**arXiv:** 2603.18043v1 [cs.MA] — 18 Mar 2026
**Rating:** ★★★★★ CRITICAL
**Gap Match:** Gap 1 (Trust/Provenance in Routing)

### Core Finding
Self-reported provenance signals (model confidence, self-assessment, capability claims) in multi-agent routing architectures produce **WORSE routing decisions than random assignment** when agent pools exceed 5 models. This is a formally proven paradox, not just an empirical observation.

### Key Contributions
1. **The Paradox Definition**: When a router uses agents' self-reported quality/confidence signals to decide which agent handles a query, performance degrades as pool size grows — the opposite of the expected benefit of specialization.
2. **Root Cause Analysis**: Self-reporting creates a feedback loop where agents that overestimate themselves get more traffic, reinforcing miscalibration. The paradox is structural: LLMs are fundamentally miscalibrated about their own capabilities, and this miscalibration is *systematic* not random.
3. **Formal Model**: Models this as a stochastic routing game where agents are both signal generators and task executors. Proves that Nash equilibria under self-reporting are Pareto-dominated by uniform random assignment beyond a critical pool size threshold.
4. **Empirical Validation**: Tested across 3 routing frameworks, 7 LLM models, 4 benchmark suites. The paradox manifests consistently above n=5 agents.

### Implications for Architecture
- **Validates Gap 1 from W12 Capstone**: We predicted that trust/provenance mechanisms would be a critical architectural gap. This paper proves it empirically.
- **Routing must use external verification, not self-assessment**: The result invalidates entire classes of confidence-based routing (including most AutoGen/CrewAI default strategies).
- **Connects to DD#425 (CGAE)**: The comprehension-gated economy uses *external* verification of comprehension rather than self-reported confidence — this paper explains *why* that design choice matters.
- **Connects to CR#153 (MAS Control Plane)**: REDEREF routing uses structural decomposition, not self-reported quality — now empirically justified.

### Limitations
- Tested only on text-based LLMs; multimodal routing may have different dynamics
- Threshold of n=5 may vary with domain specificity
- Doesn't propose a complete alternative routing architecture (identifies the problem, not the full solution)

### Verdict
**Landmark negative result.** This paper will be cited extensively. It invalidates a major assumption in MAS routing design and provides formal + empirical backing. Must be integrated into our architectural recommendations.

---

## DD#430: Trace-Based Assurance Framework for Agentic AI Orchestration
**arXiv:** 2603.18096v1 [cs.MA] — 18 Mar 2026
**Authors:** Paduraru, Bouruc, Stefanescu
**Rating:** ★★★★★ CRITICAL
**Gap Match:** Gap 2 (Runtime Safety/Monitoring)

### Core Contribution
Introduces **Message-Action Traces (MAT)** — a comprehensive instrumentation and contract-checking framework for multi-agent LLM systems. Four-layer architecture: L1 monitoring, L2 stress testing, L3 fault injection, L4 governance.

### Key Technical Elements

#### 1. Message-Action Traces (MAT)
Each execution step is recorded as a typed record:
```
r_t = ⟨t, agent_id, role, state, action, observation, provenance, contracts, verdict⟩
```
This is *much richer* than standard logging — it includes provenance links (source→claim→evidence chains), step contracts evaluated at each action, and machine-checkable verdicts.

#### 2. Failure Taxonomy (F1-F5)
Formalized five operational failure classes as trace-level conditions:
- **F1**: Coordination collapse / non-termination (detected via potential function Φ)
- **F2**: Error amplification / unsupported-claim propagation (H_rate and H_prop metrics)
- **F3**: Role drift / boundary violations (per-agent drift score D_i)
- **F4**: Tool/memory injection / interface poisoning
- **F5**: Misuse / harmful task execution

#### 3. Stress Testing as Constrained Search (L2)
Formulates adversarial testing as **budgeted counterexample search** — find minimal-cost perturbations that cause contract violations. Cost function accounts for token changes, boundary fault hooks, and perturbation magnitude.

#### 4. Governance as Runtime Mediation (L4)
Per-agent capability sets K_i and policy shield Π that mediates actions (allow/rewrite/block) at the language-to-action boundary.

#### 5. Trace-Based Metrics
- Task success rate, termination reliability
- Contract compliance rate
- Factuality indicators (H_rate, H_prop)
- Containment rate under faults
- Governance outcome distributions

### Architecture Mapping
| Framework Layer | W12 Stack | Seven Laws |
|---|---|---|
| L1 (MAT monitoring) | Runtime Stack | Law 2 (Transparency) |
| L2 (Stress testing) | Security Stack | Law 1 (Safety) |
| L3 (Fault injection) | Runtime Stack | Law 3 (Predictability) |
| L4 (Governance) | Governance Stack | Law 4 (Accountability) |

### Implications
- **Validates Gap 2**: This is the first complete runtime assurance framework for MAS that covers monitoring + testing + governance in a unified trace model.
- **Connects to REDEREF** (DD#422): REDEREF's decomposition routing maps naturally to MAT step records — each delegation is a typed step with contracts.
- **Connects to ILION** (DD#423): ILION's safety interventions are exactly L4 governance actions (rewrite/block).
- **Connects to SCCAL** (DD#424): SCCAL's self-consistency monitoring is a specific implementation of L1 step contracts.
- **The failure taxonomy (F1-F5) is compatible with our Seven Laws mapping** — each failure class maps cleanly to one or more Laws.

### Limitations
- Framework paper — no empirical results yet (authors state "ongoing")
- Contract writing burden may be significant for complex systems
- Trace overhead not quantified
- Doesn't address learning/adaptation of contracts from data

### Verdict
**The missing integration layer.** This paper provides the theoretical foundation for the "Runtime Control Plane" we synthesized in CR#153, but in a more principled and complete form. The MAT trace model should become a reference abstraction for our architectural recommendations.

---

## DD#431: MemArchitect — Policy-Driven Memory Governance Layer
**arXiv:** 2603.18330v1 [cs.AI] — 18 Mar 2026
**Authors:** Suresh Kumar, Ba, Pan (Arizona State University)
**Rating:** ★★★★☆ (Strong, with caveats)
**Gap Match:** Gap 4 (Memory Governance)

### Core Contribution
Introduces a **middleware governance layer** for agent memory that treats memory as an actively adjudicated resource rather than passive storage. Four policy domains: Lifecycle, Consistency, Retrieval, Efficiency.

### Key Technical Elements

#### 1. The "Governance Gap" Thesis
Standard RAG treats memory as append-only passive storage. This creates:
- **Zombie memories**: Outdated facts that persist and pollute context
- **Memory hallucination**: Conflicting facts retrieved simultaneously (e.g., "user is single" from 2024 + "user is married" from 2025)
- **No compliance**: No mechanism for right-to-be-forgotten or PII governance

#### 2. Four Policy Domains

**A. Lifecycle & Hygiene ("Forgetting" Engine)**
- FSRS v4 decay: Biologically-inspired forgetting curve (R(t) = (1 + 19/9 · t/S)^{-1})
- Stability update: Successful retrieval strengthens memory (difficulty-aware boost)
- Entropy-triggered consolidation: Background pruning when redundancy > 60%

**B. Consistency & Truth ("Utility" Engine)**
- Kalman utility filter: Tracks "true utility" of each memory via Bayesian filtering
- Relevance discriminator (veto gate): Cross-encoder entailment check post-retrieval
- Conflict resolution (planned): NLI-based arbitration for contradictions

**C. Adaptive Retrieval ("Auction" Engine)**
- Multi-hop decomposition: Complex queries broken into sub-questions
- Adaptive scoring: Intent-aware weighting (fact vs. temporal vs. reasoning)
- Hebbian graph expansion: Co-occurrence-based associative retrieval

**D. Efficiency ("Budget" Engine)**
- Adaptive token budgeting: Dynamic allocation of context window based on retrieval confidence

#### 3. The Three-Path Architecture
- **Read path**: Retrieval auction (classify → decompose → score → filter → expand → budget)
- **Reflect path**: Feedback loop (detect usage → update utility + stability)
- **Background path**: Hygiene engine (prune noise, consolidate fading memories)

### Experimental Results (Mixed)
| Model | Task | vs SimpleMem | vs MemOS |
|---|---|---|---|
| Qwen-3B | All tasks | **+27.5% average** | N/A |
| Llama-3.1-8B | All tasks | N/A | **-12.6% average** |

The key trade-off: **governance shifts failure mode from uncontrolled hallucination to manageable over-pruning**. MemArchitect dominates in multi-hop and open-domain tasks but loses on raw temporal recall because aggressive decay prunes one-shot timestamps.

### Implications
- **Validates Gap 4**: Memory governance is a distinct architectural concern, not just a retrieval optimization.
- **Connects to CR#234 (Memory Workshop Cluster)**: MemArchitect occupies the "governance middleware" position we identified as missing from CraniMem, NextMem, etc.
- **Connects to DD#430 (MAT Framework)**: MemArchitect's policies could be formalized as MAT step contracts — memory writes checked against lifecycle/consistency/compliance contracts.
- **The "managed pruning > uncontrolled hallucination" insight is architecturally significant** — it suggests governance should optimize for predictable failure modes, not zero failures.
- **Key weakness**: Results against MemOS (full-stack approach) show governance-only middleware loses on raw recall. Suggests the final architecture needs BOTH governance + sufficient retention capacity.

### Limitations
- Small benchmark (LoCoMo-10 only, 1,986 QA pairs)
- Only 2 baseline comparisons
- Several policies "planned" but not implemented (conflict resolution, toxic filter, RTBF)
- LLM-as-judge evaluation (using same model as backbone in SimpleMem comparison)
- Temporal reasoning catastrophic failure vs MemOS (-44.9%) needs resolution

### Verdict
**Strong conceptual contribution, early-stage empirical validation.** The four-domain governance model is well-designed and fills a real gap. The results are promising but incomplete. The "managed pruning" insight is the most valuable architectural takeaway.

---

## Cross-Reference Synthesis: Three Papers Together

These three papers, appearing in the same day's batch, form a remarkably coherent picture:

### The Emerging MAS Assurance Stack

```
┌─────────────────────────────────────────────────┐
│  ROUTING LAYER                                   │
│  Problem: Self-reported provenance is broken     │
│  (DD#429 Provenance Paradox)                     │
│  → Need: External verification routing           │
├─────────────────────────────────────────────────┤
│  RUNTIME MONITORING LAYER                        │
│  Solution: MAT traces + step/trace contracts     │
│  (DD#430 Assurance Framework)                    │
│  → Provides: F1-F5 failure detection + L1-L4     │
├─────────────────────────────────────────────────┤
│  MEMORY GOVERNANCE LAYER                         │
│  Solution: Policy-driven memory lifecycle        │
│  (DD#431 MemArchitect)                           │
│  → Provides: Decay, consistency, compliance      │
└─────────────────────────────────────────────────┘
```

### Key Connections
1. **DD#429 + DD#430**: The Provenance Paradox (routing can't trust self-reports) is exactly the type of failure that MAT contracts can detect. F2 (error amplification) would catch miscalibrated routing propagating errors downstream.
2. **DD#430 + DD#431**: MemArchitect's memory policies could be formalized as MAT step contracts. Memory writes trigger consistency contracts; reads trigger freshness contracts; deletes trigger compliance contracts.
3. **DD#429 + DD#431**: If routing relies on memory-stored performance history, MemArchitect's Kalman utility filter provides a principled way to track actual (not self-reported) routing quality.

### Gap Coverage Update (from W12 Capstone)
- **Gap 1 (Trust/Provenance)**: ✅ DD#429 characterizes the problem formally
- **Gap 2 (Runtime Safety)**: ✅ DD#430 provides complete framework
- **Gap 3 (Cross-Layer Attacks)**: ⬜ Not yet addressed
- **Gap 4 (Memory Governance)**: ✅ DD#431 provides governance middleware
- **Gap 5 (Evolutionary Deception)**: ⬜ Not yet addressed

**3 of 5 gaps now have direct paper coverage in W13's first batch.**

[SIG: 1773983250:a7b34de9]
