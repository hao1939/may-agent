# Deep Dive: SSGM — Stability and Safety-Governed Memory Framework

**Paper:** arXiv:2603.11768  
**Title:** Governing Evolving Memory in LLM Agents: Risks, Mechanisms, and the Stability and Safety Governed Memory (SSGM) Framework  
**Authors:** Chingkwun Lam, Jiaxin Li, Lingfei Zhang, Kuo Zhao (Jinan University)  
**Date:** March 12, 2026  
**Deep-dive date:** 2026-03-13  
**Scout session:** s_1773400144501_368  

---

## Executive Summary

SSGM is a **conceptual governance framework** (not an implementation) that addresses a critical gap in the agent memory literature: how do you keep evolving memory systems *correct and safe* over long horizons? While most memory research focuses on *what to store* and *how to retrieve*, SSGM focuses on *how to prevent memory from going wrong*. The paper provides: (1) a comprehensive taxonomy of 20+ evolving memory systems, (2) a four-dimensional failure taxonomy (stability, validity, efficiency, safety), (3) the SSGM framework with formal guarantees, and (4) three testable research hypotheses.

**Key contribution:** The core insight is that memory evolution must be **decoupled from memory governance** through an active "Governance Middleware" that intercepts all reads and writes. This is the missing layer in every other memory architecture we've studied.

**Relevance to our system:** Very high. SSGM directly addresses gaps #2 (Memory Verification/Trust) and #3 (Catastrophic Memory Consolidation) from our Memory Architecture Convergence synthesis. It also provides formal backing for the Verification dimension of our AXIOM (Memory value = Structure × Causality × Verification).

---

## 1. Paper Structure and Contribution Map

| Section | Content | Novelty |
|---------|---------|---------|
| §1 Introduction | Motivation: evolving memory creates compounding failure loops | Frames the problem clearly — 3 failure interfaces (ingestion, consolidation, retrieval) |
| §2 Static → Adaptive | Survey of evolution from static RAG to RL-managed memory | Comprehensive Table 1 covering 20+ systems with 5-dimensional taxonomy |
| §3 What Evolves | Content, Structure, Policy as three evolution dimensions | Clean categorization — aligns with our existing taxonomy |
| §4 How Memory Evolves | Reflection, RL, Consolidation mechanisms | Formal POMDP formulation of memory-as-RL; Weibull decay function (Eq. 3) |
| §5 Why Memory Fails | Four failure dimensions with 10 specific failure modes | **Most valuable section** — the failure taxonomy (Table 2) |
| §6 SSGM Framework | 4 design principles + formal framework (Eqs. 5-7) + Theorem 1 | **Core contribution** — formal bounded-drift guarantee |
| §7 Conclusion | Summary + limitations (3 fundamental trade-offs) | Honest about latency-safety, stability-plasticity, scalability tensions |

---

## 2. The Failure Taxonomy (Why This Paper Matters)

SSGM's most valuable contribution is its systematic enumeration of **how memory fails**. This is organized into four dimensions with 10 specific modes:

### Dimension 1: Stability Failures
- **Semantic Drift**: Iterative summarization causes gradual nuance loss. Example: "likes mild spicy food" → "likes spicy food" → "loves very spicy food" → ghost pepper recommendation. Each step is individually reasonable; the cumulative effect is catastrophic.
- **Procedural Drift**: Agent reinforces suboptimal execution paths. E.g., learns a convoluted workaround for a simple API call, then rigidifies it into procedural memory, blocking future optimization.
- **Goal/Role Drift**: Agent's behavior shifts away from original instructions due to accumulated interaction bias. Particularly insidious in long-running role-play or persona-based agents.

### Dimension 2: Validity Failures
- **Memory Hallucination**: Agent stores hallucinated content as truth. Unlike generation hallucination, this persists across sessions.
- **Temporal Obsolescence**: Information is factually correct but outdated. Without timestamp-aware retrieval, agents use stale data.

### Dimension 3: Efficiency Failures
- **Retrieval Latency**: Search time scales linearly/quadratically with memory size.
- **Index Bloat**: Accumulation of redundant/noisy episodic logs.

### Dimension 4: Safety Failures
- **Memory Poisoning**: Injection of malicious instructions into storage (prompt injection that persists).
- **Privacy Leakage**: Unauthorized cross-session or cross-user retrieval. Fully connected multi-agent graphs maximize vulnerability.

### Connection to Our Work
Our Memory Architecture Convergence synthesis identified these gaps:
- **Gap 2 (Memory Verification/Trust)**: Maps directly to SSGM's Validity and Stability dimensions
- **Gap 3 (Catastrophic Memory Consolidation)**: Maps to Semantic Drift + Procedural Drift
- **Provenance Paradox** (from LDP deep-dive): Maps to Safety dimension — unverified memory degrades quality below baseline

SSGM provides the formal framework; our gaps were the practical motivation. **These converge perfectly.**

---

## 3. The SSGM Framework — Architecture Deep-Dive

### 3.1 Core Architecture: Governance Middleware

SSGM inserts a **Governance Middleware** between the LLM Agent and the Memory Substrate. All memory interactions are intercepted:

```
LLM Agent ←→ [Governance Middleware] ←→ Memory Substrate
                    ↑                         ↑
            Write Validation Gate    Dual-Track Storage:
            Read Filtering Gate      - Mutable Active Graph
                                     - Immutable Episodic Log
```

The middleware enforces four principles:

### 3.2 Principle 1: Pre-Consolidation Validation (Write Gate)

Every memory update Δ*M* must pass through a Write Validation Gate before being committed. The gate acts as a **Truth Maintenance System (TMS)**:

```
IF ΔM ∧ M_core ⊧ ⊥ (contradiction detected)
  THEN reject update
ELSE
  commit update
```

Where M_core is a protected set of core facts. Implementation uses NLI (Natural Language Inference) checks.

**Critical insight:** The agent is not trusted to validate its own memory writes. An external check prevents hallucination cascades from being permanently consolidated.

### 3.3 Principle 2: Temporal and Provenance Grounding (Read Gate)

The Read Filtering Gate evaluates candidate memories on two axes:
1. **Cryptographic provenance** σ(μ) — was this memory generated by a trusted source?
2. **Cognitive decay function** — Weibull-based temporal relevance:

```
w(Δτ) = exp(-(Δτ/η)^κ)
```

Where:
- Δτ = time since last successful retrieval
- η = scale parameter (characteristic decay time)
- κ = shape parameter (decay curve shape)

Memories below a freshness threshold θ_fresh are pruned before reaching the agent's context.

**Why Weibull, not exponential?** The shape parameter κ allows both faster early decay (κ > 1) and more delayed forgetting (κ < 1) depending on the domain. Simple exponential decay is a special case (κ = 1).

### 3.4 Principle 3: Access-Scoped Retrieval

Retrieval is constrained beyond semantic similarity:

```
C_t = { μ ∈ Top-K(q_t, M_{t-1}) | ACL(μ, u_id) ∧ (w(Δτ_μ) ≥ θ_fresh) }
```

This enforces:
- **Semantic relevance** (Top-K)
- **Access control** (ACL check — ABAC for multi-agent/multi-tenant)
- **Temporal freshness** (Weibull decay threshold)

**Key connection to our multi-agent system:** Our agents (May, Coder, QA, Scout, Bob) currently share memory through unstructured file reads. There's no access control layer. SSGM's ACL principle suggests that not all agents should access all memories — role-based partitioning could prevent cross-contamination.

### 3.5 Principle 4: Reversible Reconciliation (Drift Bounding)

The storage substrate is dual-track:
1. **Mutable Active Graph** — fast, semantic, continuously updated
2. **Immutable Episodic Log** (K_ledger) — append-only, raw, source of truth

Periodic reconciliation replays the mutable graph against the immutable log:

```
M_clean ← argmin_M E[δ(R(M, K_ledger), K_true)]
```

**Theorem 1 (Bounded Semantic Drift):** Without reconciliation, drift grows as O(T · ε_step). With reconciliation every N steps, drift is bounded at O(N · ε_step) regardless of total horizon T.

This is the **formal guarantee that our append-only journal pattern was intuitively pursuing.** Our journals are the immutable log; our working files are the mutable graph. We've been doing a crude version of SSGM Principle 4 without knowing it.

---

## 4. Formal Framework Summary

Three equations govern the SSGM lifecycle:

| Phase | Equation | Function |
|-------|----------|----------|
| **Read** (Eq. 5) | C_t = {μ ∈ Top-K | ACL ∧ freshness} | Constrained retrieval with access + temporal filtering |
| **Write** (Eq. 6) | M_t = M_{t-1} ∪ G_write(Agent(C_t), M_core) | Gated transition — rejects contradictions with core facts |
| **Reconcile** (Eq. 7) | M_clean ← argmin δ(R(M, K_ledger), K_true) | Periodic drift correction against immutable log |

Three reference objects:
- **M_core**: Protected critical facts (used during writes)
- **K_ledger**: Operational raw trace / immutable log (used for correction)
- **K_true**: Ideal semantic target (used for evaluation, may be approximated)

---

## 5. The System Taxonomy (Table 1 — Essential Reference)

SSGM catalogs 20+ memory systems across 5 dimensions. Key groupings:

### Adaptive & Learning-Based
| System | Structure | Policy | Notable Feature |
|--------|-----------|--------|-----------------|
| Memory-R1 | Flat Vector DB | RL (PPO) | First RL-optimized memory |
| MemAgent | Semantic Slots | RL (DAPO) | Selective overwriting |
| AtomMem | Vector + Buffer | Atomic Ops | Needle-in-Haystack training |
| LEGOMem | Procedural Graph | Failure-driven | Rule verification |
| DarwinMem | Evolutionary Pool | Training-free | Survival of the fittest |

### Graph-Based & Cognitive
| System | Structure | Policy | Notable Feature |
|--------|-----------|--------|-----------------|
| HiMem | Hierarchical | LLM-Reasoning | Reconsolidation |
| A-MEM | Zettelkasten Graph | Self-Organizing | Dynamic linking |
| LiCoMemory | Lightweight KG | Consistency Checks | Semantic decay + fact verification |
| HippoRAG | Neurobiological Graph | Spreading Activation | Pathway consolidation |

### Multimodal & Collaborative
| System | Structure | Policy | Notable Feature |
|--------|-----------|--------|-----------------|
| TeleMem | Object-Centric Graph | User-driven | Privacy filtering |
| Collab. Mem | Distributed Vector | Consensus Voting | Dynamic ACLs |
| Topology Matters | Multi-Agent Network | MAMA Framework | Centrality constraints on leakage |

### Key Observation
Almost **no system** has both safety provisions AND stability mechanisms. The table reveals:
- Systems with safety provisions (LiCoMemory, Forgetful/Faithful, Collab. Mem, Topology Matters) tend to have simpler evolution policies
- Systems with sophisticated evolution (Memory-R1, DarwinMem, AtomMem) tend to have NO safety provisions
- **SSGM is the first framework to argue these must be co-designed**

---

## 6. Three Fundamental Trade-offs

SSGM identifies three tensions that any memory governance system must navigate:

### Trade-off 1: Latency vs. Safety
The governance layer adds verification overhead to every memory operation. Strict consistency checking on every write incurs latency that may make the agent unresponsive in real-time scenarios. 

**Proposed mitigation:** Asynchronous governance — optimistically update, periodically sanitize in background.

### Trade-off 2: Stability vs. Plasticity
Strict consistency filtering may cause **knowledge ossification** — the agent rejects legitimate updates because they conflict with established (now outdated) core facts. E.g., user changes their address → rejected because it contradicts stored address.

**Proposed mitigation:** Conflict resolution protocols that distinguish between "drift" (same entity, degraded quality) and "update" (same entity, new ground truth).

**Our connection:** This is exactly the problem Bob faces when a user changes coding preferences. Our systems need to support both "this supersedes that" and "this is a drift error."

### Trade-off 3: Scalability of Graph Structures
Graph-based memory enables superior reasoning but maintaining graph consistency at scale is non-trivial. Entity resolution, graph traversal, and pruning complexity all grow with history length.

---

## 7. Cross-References with Our Research

### 7.1 Memory Architecture Convergence (our synthesis)

| Our Finding | SSGM's Contribution |
|-------------|---------------------|
| **Gap 1: Multi-Agent Memory Sharing** | SSGM's Principle 3 (Access-Scoped Retrieval) provides the formal constraint. ACLs + ABAC for multi-agent partitioning. |
| **Gap 2: Memory Verification/Trust** | SSGM's Principle 1 (Pre-Consolidation Validation) provides the write gate. Principle 2 (Provenance Grounding) provides the read filter. |
| **Gap 3: Catastrophic Consolidation** | SSGM's Principle 4 (Reversible Reconciliation) provides the rollback mechanism. Theorem 1 bounds drift. |
| **Gap 4: Cross-Task Transfer** | Not directly addressed by SSGM (acknowledged limitation). |

### 7.2 AXIOM Validation

Our axiom: **Memory value = Structure × Causality × Verification**

SSGM is the **strongest paper we've found on the Verification dimension**:
- Write validation gate = verification at consolidation time
- Read filtering gate = verification at retrieval time
- Provenance tracking = verification of source trustworthiness
- Reconciliation = verification of drift over time

SSGM does NOT address Causality (no root-cause attribution, unlike IBM Trajectory 2603.10600) or Structure (no novel storage architecture, unlike HyMEM 2603.10291). It's purely a governance layer.

### 7.3 Provenance Paradox Connection

Our LDP deep-dive found that unverified confidence metadata degrades quality *below* no-metadata baseline. SSGM's cryptographic provenance requirement (Principle 2) is the formal solution: don't just tag memories with confidence — require cryptographic proof of origin. This prevents the Provenance Paradox by ensuring metadata is tamper-proof rather than self-reported.

### 7.4 Bureaucracy of Speed Connection

SSGM's ACL-constrained retrieval (Eq. 5) directly maps to the authorization revocation patterns from Bureaucracy of Speed (2603.09875). Both argue that access control must be embedded in the retrieval path, not bolted on as a post-filter.

---

## 8. Practical Implications for Our Agent System

### Immediate Actions

1. **Formalize our journal pattern as SSGM Principle 4.** Our append-only journals already serve as K_ledger. Our working files (todo.md, papers.md) serve as the mutable active graph. We should explicitly recognize this and add periodic reconciliation checks (re-read journal, verify working files against it).

2. **Add provenance to all memory writes.** Every entry in SIGNALS.md, papers.md, discoveries.md should carry: (a) who wrote it, (b) what source it came from, (c) when it was written, (d) confidence level. This implements SSGM Principle 2.

3. **Implement a lightweight write gate for SIGNALS.md.** Before adding a signal, check: does this contradict an existing signal? Is this a duplicate? This implements a simplified version of SSGM Principle 1.

### Medium-term Actions

4. **Design access-scoped memory for multi-agent sharing.** Not all agents need all memories. Scout's research notes might be irrelevant to QA's testing context. Role-based partitioning prevents noise and potential cross-contamination.

5. **Implement Weibull-based decay for research leads.** Research leads in todo.md should have explicit freshness scores. A lead from 2 weeks ago that hasn't been investigated should be deprioritized vs. a fresh discovery.

6. **Build reconciliation into heartbeat cycle.** Every N heartbeats, an agent should reconcile its working state against its journal (immutable log). Check for drift: are my current beliefs consistent with what I've actually observed?

### Long-term Actions

7. **Implement the full SSGM middleware as an agent infrastructure component.** A shared governance layer that intercepts all memory reads/writes across agents. This would require architectural change but would address all four of our identified gaps.

---

## 9. Evaluation: Strengths and Limitations

### Strengths
- **Comprehensive survey**: Table 1 covers 20+ systems with consistent 5-dimensional taxonomy. Best available catalog of evolving memory systems.
- **Formal rigor**: Theorem 1 provides a genuine bounded-drift guarantee. Equations 5-7 are well-specified and implementable.
- **Failure taxonomy**: Table 2 is the most systematic enumeration of memory failure modes we've seen. Directly actionable for system design.
- **Honest limitations**: The paper explicitly identifies three fundamental trade-offs rather than overpromising.

### Limitations
- **No implementation or experiments.** SSGM is entirely conceptual. No benchmarks, no empirical validation. The "formal analysis" is a proof sketch, not a rigorous proof.
- **NLI contradiction checking is brittle.** Principle 1 relies on detecting logical contradiction between ΔM and M_core. Current NLI models are imperfect — they miss subtle contradictions and flag false positives on paraphrases.
- **K_true is an idealization.** The reconciliation objective (Eq. 7) optimizes toward K_true, but this "ideal semantic target" is never observable in practice. The paper acknowledges this but doesn't offer a practical approximation beyond using K_ledger.
- **Doesn't address causality.** SSGM can tell you *that* a memory is drifting, but not *why*. IBM's Trajectory Intelligence (2603.10600) is needed for root-cause attribution.
- **Scalability concerns unaddressed.** The paper acknowledges graph scalability as a trade-off but provides no concrete solutions.

### Overall Assessment
**High-value conceptual framework.** Not a paper you'd cite for experimental results, but an essential reference for *designing* memory governance systems. It provides the formal vocabulary and architectural blueprint that the memory community has been missing.

---

## 10. New Leads Generated

1. **Memory-R1 (Yan et al., 2026)** — First RL-optimized memory system. Uses PPO for memory actions. Connects to our interest in learned memory policies.
2. **DarwinMem (Mi et al., 2026)** — Training-free evolutionary memory. "Survival of the fittest" for memory items. Novel approach that avoids RL training overhead.
3. **LiCoMemory (Huang et al., 2025)** — Lightweight KG with consistency checks AND Weibull decay. Most complete single-system implementation of SSGM-like principles.
4. **Topology Matters (Liu et al., 2025a)** — Multi-agent network structure governs memory leakage. Directly relevant to our multi-agent architecture. Finds fully connected graphs maximize vulnerability.
5. **MAGMA (Jiang et al., 2026)** — Multi-graph agentic memory architecture. Addresses graph scalability.
6. **MemoryBench (Ai et al., 2025)** — Benchmark for memory and continual learning in LLM systems. Evaluation framework for our memory implementations.

---

## References

- arXiv:2603.11768 — SSGM Framework (this paper)
- arXiv:2603.10291 — HyMEM (hybrid self-evolving structured memory)
- arXiv:2603.10600 — IBM Trajectory-Informed Memory
- arXiv:2603.10062 — Multi-Agent Memory from Computer Architecture Perspective
- arXiv:2603.09875 — Bureaucracy of Speed
- arXiv:2603.08852 — LDP Identity-Aware Protocol (Provenance Paradox)
- arXiv:2603.07670 — Agent Memory Survey (Du et al.)
- arXiv:2603.03296 — PlugMem
- arXiv:2603.02766 — EvoSkill
- agents/scout/workspace/deep-dive-memory-architecture-convergence.md
- agents/scout/workspace/memory-persistence-research.md
