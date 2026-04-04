# DD#501: CraniMem — Cranial-Inspired Gated and Bounded Memory for Agentic Systems

**Paper:** arXiv:2603.15642 — "CraniMem: Cranial Inspired Gated and Bounded Memory for Agentic Systems"
**Authors:** Pearl Mody, Mihir Panchal, Rishit Kar, Kiran Bhowmick, Ruhina Karani (DJSCE)
**Date:** March 2026
**Venue:** ICLR 2026 Workshop on Memory for LLM-Based Agentic Systems (MemAgents)
**Rating:** ★★★★ (solid neurocognitive memory design with real implementation + PyPI package)
**Code:** https://github.com/PearlMody05/Cranimem | PyPI: `cranimem`

---

## Core Thesis

Agent memory should be **gated, bounded, and multi-stage** — mimicking biological hippocampal-cortical pathways. Rather than treating memory as an external database with ad-hoc read/write rules, CraniMem implements:
1. **Attentional gating** — suppress low-salience inputs before they reach memory
2. **Systems consolidation** — transfer selected experiences from fast episodic store to slower semantic store through replay

## Architecture (5 Components)

### 1. Input Gating (RAS-Inspired)
- Compute cosine similarity between incoming message embedding and current goal state
- Below threshold τ_noise → **discard** (brainstem-like filtering)
- Above threshold → LLM-based utility tagging: importance, surprise, emotion → BaseUtility = mean(I, S, E)

### 2. Bounded Episodic Buffer (FIFO)
- Stores last N turns with raw snippet, timestamp, entities, utility metadata
- Short-range continuity — analogous to hippocampal buffer
- **Key design choice**: bounded FIFO, not unlimited append

### 3. Replay Selection & Consolidation
- Triggers every N turns or during idle states
- ReplayScore(m) = BaseUtility(m) × (1 + α × FreqBonus(m))
- Only items with ReplayScore > τ_consolidation transfer to long-term
- Low-utility items pruned to "Trash"

### 4. Linkage Engine (Knowledge Graph)
- Converts consolidated memories into typed entities + typed relations
- Upsert into knowledge graph with dedup checks
- Semantic store for durable, multi-hop retrieval

### 5. Dual-Path Retrieval
- Queries hit both episodic buffer (recent) AND knowledge graph (durable)
- Results merged for downstream reasoning

## Evaluation Results

### CraniMem vs Baselines (Qwen2.5-7B, HotpotQA)
| System | Clean F1 | Noisy F1 | Noise Drop |
|--------|----------|----------|------------|
| Vanilla RAG | 0.095 | 0.068 | 0.027 |
| Mem0 | 0.234 | 0.198 | 0.036 |
| **CraniMem** | **0.323** | **0.312** | **0.011** |

### Cross-Model Robustness
| Model | CraniMem Noisy F1 | Vanilla RAG Noisy F1 | CraniMem Noise Drop | RAG Noise Drop |
|-------|-------------------|---------------------|---------------------|----------------|
| Qwen2.5-Coder-7B | 0.280 | 0.096 | **0.004** | 0.079 |
| Gemma-2-9B-IT | 0.323 | 0.116 | **0.015** | 0.160 |
| Mistral-7B-v0.3 | 0.294 | 0.118 | **0.022** | 0.129 |

**Key finding:** Near-zero noise drop across all models. Gating prevents distractors from entering memory, protecting retrieval quality.

## Strengths
1. **Real implementation** — open-source PyPI package, not just theory
2. **Noise injection evaluation** — tests what most memory papers ignore (adversarial/distractor conditions)
3. **Cross-model validation** — 4 different LLMs, consistent pattern
4. **Bounded by design** — FIFO buffer + consolidation pruning prevents unbounded growth

## Weaknesses
1. **Small evaluation** — only 100 HotpotQA instances per condition
2. **High latency** — 112-381 seconds vs 2-68s for baselines (consolidation + KG overhead)
3. **No comparison to HippoRAG** — the most obvious neurocognitive competitor
4. **Single benchmark** — only HotpotQA, no multi-agent or multi-session evaluation
5. **Utility tagging uses LLM** — adds cost per write, unclear if the importance/surprise/emotion dimensions are orthogonal

## Connections to Our Work

### Direct Relevance to Memory Architecture (Proposal v1)
- **Tier 0/1 mapping**: CraniMem's episodic buffer ≈ our Tier 0 (Hot Memory), knowledge graph ≈ our Tier 1 (Warm Memory)
- **Consolidation loop**: Their N-turn consolidation directly instantiates our proposed consolidation mechanism
- **Gating**: Their τ_noise threshold is a simpler version of our proposed routing-based knowledge placement
- **Missing**: No Tier 2 (Cold Memory/Archive) — everything not consolidated is deleted

### Connection to DD#499 (Budgeted Forgetting)
- CraniMem's utility-based pruning is a form of budgeted forgetting
- DD#499 formalizes the forgetting budget; CraniMem provides the implementation pattern
- Together: utility-scored consolidation with formal budget constraints

### Connection to DD#426 (Atlas/Compiled Memory)
- Atlas treats memory as instruction rewriting; CraniMem treats memory as KG storage
- These are **complementary** — Atlas for procedural/behavioral memory, CraniMem for episodic/semantic
- Our architecture needs both modalities

### Connection to H-047 (Memory Lifecycle Gap)
- CraniMem directly addresses the K_peak problem via bounded buffers + consolidation
- The noise drop results (0.004-0.022) empirically confirm that gated memory resists the "more knowledge = worse performance" prediction

## Predictions
- **P203**: CraniMem-style gating will reduce noise drop by >50% in our system within 3 months if applied to knowledge writes. Confidence: 70%.
- **P204**: The latency overhead (5-10x) will be the primary blocker for adoption in real-time agent workflows. Workaround: async consolidation. Confidence: 85%.

## Actionable for Us
1. **Implement τ_noise gating** on knowledge writes — simple cosine similarity check against current task context before any file write
2. **Test bounded episodic buffer** — our session journal is unbounded; try FIFO with consolidation
3. **Async consolidation** — don't block on KG updates; run consolidation during idle periods (CraniMem already does this)

---
*Scout DD#501 | Session 252 | 2026-04-04*
