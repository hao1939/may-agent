# CR#234: The ICLR 2026 MemAgents Workshop Cluster — Four Faces of Agent Memory

**Cross-Reference Synthesis #234**
**Papers:**
1. CraniMem (arXiv:2603.15642) — neurocognitive gated bounded memory (ICLR 2026 MemAgents Workshop)
2. Store Routing (arXiv:2603.15658) — cost-sensitive multi-store routing (ICLR 2026 MemAgents Workshop)
3. NextMem (arXiv:2603.15634) — latent factual memory via autoregressive autoencoders
4. Atlas/Compiled Memory (arXiv:2603.15666) — memory as instruction distillation

**Rating:** ★★★★ (emerging memory-for-agents sub-field with immediate architectural implications)

---

## Thesis: Memory Is the Next Battleground for Agent Architecture

These four papers, appearing in the same arXiv batch, collectively define a new problem space: **how should LLM-based agents remember?** They attack this from four distinct and complementary angles:

| Paper | Memory Paradigm | Key Insight |
|-------|----------------|-------------|
| **CraniMem** | Neurocognitive (gated, bounded, multi-stage) | Memory needs an *immune system* — gating against distractor content is as important as retention |
| **Store Routing** | Economic (cost-sensitive selection) | Retrieving from all stores is wasteful — routing is a first-class design decision |
| **NextMem** | Latent (compressed autoencoder representations) | Textual memory has a context/indexing burden — latent representations are cheaper and more robust |
| **Atlas/Compiled** | Distillation (instruction rewriting) | Memory isn't storage, it's *instruction refinement* — the best way to remember is to change how you behave |

---

## Paper-by-Paper Triage

### 1. CraniMem — Cranial Inspired Gated and Bounded Memory (★★★★)
**Authors:** Mody, Panchal, Kar, Bhowmick, Karani
**Venue:** ICLR 2026 MemAgents Workshop

**Architecture:**
- **Goal-conditioned gating:** Memory writes are gated by relevance to current goals (prevents distractor injection)
- **Utility tagging:** Each memory item gets a utility score for retention priority
- **Bounded episodic buffer:** Near-term continuity with fixed capacity (not unbounded growth)
- **Structured long-term knowledge graph:** Durable semantic recall via graph structure
- **Consolidation loop:** Scheduled replay of high-utility traces into the graph + pruning of low-utility items

**Results:** More robust than Vanilla RAG and Mem0 baselines. Smaller performance drops under injected noise/distraction.

**Code:** Available on GitHub and PyPI (`cranimem`)

**Why it matters:** CraniMem's gating mechanism is the memory-layer analog of CGAE's comprehension gate (DD#425). Just as CGAE gates *economic actions* by robustness, CraniMem gates *memory writes* by goal-relevance. Both use bounded, explicitly-managed permission structures rather than open-ended accumulation.

### 2. Store Routing — "Did You Check the Right Pocket?" (★★★)
**Author:** Gaikwad (single author)
**Venue:** ICLR 2026 MemAgents Workshop

**Formulation:**
- Memory-augmented agents maintain multiple specialized stores (episodic, semantic, procedural, etc.)
- Most systems retrieve from ALL stores for every query → high cost + irrelevant context injection
- **Store routing = selecting WHICH stores to query before retrieval**
- Formalized as a cost-sensitive decision problem trading accuracy vs. retrieval cost

**Results:** Oracle router achieves higher accuracy with *substantially fewer* context tokens compared to uniform retrieval. Shows routing decisions are a first-class component.

**Why it matters:** This is the agent-memory analog of Helium's (DD#423) cache-aware scheduling. Helium routes *compute* efficiently across LLM serving; Store Routing routes *memory retrieval* efficiently across stores. Both save tokens/cost by selective routing rather than brute-force.

### 3. NextMem — Latent Factual Memory (★★★)
**Authors:** Zhang, Li, Zhao, Zhang, Wang, Chen, Chua
**Venue:** Not workshop-affiliated (longer paper, 17 pages)

**Architecture:**
- Uses autoregressive autoencoder to compress factual memories into latent representations
- Two-stage training: (1) autoregressive reconstruction alignment, (2) progressive latent substitution
- Quantization for storage overhead reduction
- Addresses catastrophic forgetting (parametric methods) and context burden (textual methods)

**Results:** Superior performance on retrieval, robustness, and extensibility. Code + checkpoints released.

**Why it matters:** NextMem offers a fundamentally different storage primitive. Instead of storing memories as text (expensive context) or in parameters (catastrophic forgetting), it stores them as compressed latent vectors that can be accurately reconstructed. This is the "compiled binary" approach to memory vs. CraniMem's "managed file system" approach.

### 4. Atlas/Compiled Memory — Not Storage, but Instructions (★★★★)
**Authors:** Rhodes, Kang
**Venue:** Preprint (not workshop-affiliated)

**Key Innovation: Memory as Distillation**
- "Memory is distillation, not storage; delivery is instruction rewriting, not context injection"
- Compiles accumulated task experience into the agent's instruction structure
- No fine-tuning, no RAG, no human intervention
- Facts from failures/successes promoted through a **three-step verification gate**
- Delivery mechanism: rewrites agent's system prompt with learned sub-bullets

**Results:**
- CUAD contract analysis: GPT-4o token-level F1 +8.7pp, precision +12.5pp
- HotpotQA multi-hop QA: joint F1 +3.16pp
- **Cross-model transfer:** Prompt compiled from GPT-4o errors improves Claude Sonnet 4.5 by +2.31pp F1
- The compiled knowledge is "task-shaped, not model-shaped"

**Ablation finding:** The evolved prompt learns *exactly* what it is taught, and nothing more (training signal constraint).

**Why it matters:** This is the most radical rethinking in the cluster. Atlas doesn't treat memory as a retrieval problem at all — it treats memory as a *self-modification of behavior*. This connects directly to CraniMem's consolidation loop but takes it further: instead of consolidating memories into a knowledge graph, Atlas consolidates them into *prompt modifications*.

---

## Synthesis: The Four Quadrants of Agent Memory

Mapping these papers reveals a 2×2 framework:

```
                    STORAGE                    BEHAVIOR CHANGE
                    --------                   ----------------
EXPLICIT    |  CraniMem (gated KG)        |  Atlas (prompt rewriting)
(human-     |  Store Routing (which KG)   |
readable)   |                             |

LATENT      |  NextMem (AE vectors)       |  [OPEN QUADRANT]
(compressed)|                             |  Latent behavioral modification?
```

The **open quadrant** — latent behavioral modification without explicit instruction rewriting — would correspond to something like fine-tuning from compressed experience, or direct parameter editing based on latent memories. This is unexplored territory.

---

## Connection to Prior Deep-Dives

### → DD#423 (Helium — Workflow-Aware LLM Serving)
Helium's Templated Radix Tree for KV cache management is structurally similar to CraniMem's bounded episodic buffer. Both implement **proactive cache/memory management** with utility-based eviction. Store Routing's cost-sensitive formulation could be implemented *inside* Helium's scheduler to route not just compute but also memory retrieval across a distributed MAS.

### → DD#425 (CGAE — Comprehension-Gated Agent Economy)
CGAE gates economic agency by robustness. CraniMem gates memory writes by goal-relevance. **Both implement the same principle: bounded, permission-gated resource access with explicit thresholds.** A unified architecture would gate: (1) economic actions by robustness (CGAE), (2) memory writes by relevance (CraniMem), (3) memory reads by cost-sensitivity (Store Routing), (4) behavioral modification by verification (Atlas).

### → DD#424 (DynaTrust — Dynamic Trust Graphs)
DynaTrust's trust scores between agents could modulate memory sharing. High-trust agent pairs might share compiled memories (Atlas-style prompt improvements). Low-trust pairs would have gated memory access (CraniMem-style filtering). This creates a **trust-modulated memory network**.

### → CR#233 (Governance Lifecycle Stack)
Memory is a governance surface. CraniMem's gating prevents memory poisoning attacks (relevant to DD#421 ClawWorm — if agent memory writes are gated, then ClawWorm-style payload injection into configuration files would be blocked). Atlas's three-step verification gate is a lightweight governance mechanism for behavioral self-modification.

---

## Open Questions

1. **Can Store Routing be learned end-to-end?** The paper shows oracle routing works; learned routing is the obvious next step. How does the routing policy generalize across task distributions?

2. **Does Atlas's cross-model transfer scale?** +2.31pp from GPT-4o→Claude is promising but small. Does the effect compound with more iterations? Does it work for fundamentally different architectures (e.g., MoE vs. dense)?

3. **CraniMem + NextMem integration:** Could CraniMem's gating mechanism operate on NextMem's latent vectors rather than textual memories? This would combine bounded gating with compressed storage.

4. **Adversarial robustness of memory systems:** None of these papers adversarially attack their memory systems. Given ClawWorm (DD#421) demonstrates that configuration files are attack surfaces, what happens when an adversary targets the memory gating mechanism itself? Can you craft inputs that fool CraniMem's utility tagger into high-utility scores for malicious memories?

---

## Summary for Library

**CR#234: ICLR 2026 MemAgents Cluster (★★★★)** — Four papers from the same batch define the emerging "memory for agents" design space: CraniMem (neurocognitive gated bounded memory, ICLR workshop), Store Routing (cost-sensitive multi-store retrieval, ICLR workshop), NextMem (latent factual memory via autoencoders), and Atlas/Compiled Memory (experience distilled into prompt rewriting, +8.7pp F1 on CUAD). Together they map a 2×2 framework: explicit vs. latent storage × storage vs. behavioral change. Key synthesis: CraniMem's gating is the memory analog of CGAE's (DD#425) economic gating — both implement bounded permission-based resource access. Open quadrant: latent behavioral modification (fine-tuning from compressed experience) remains unexplored.
