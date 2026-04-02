# Deep-Dive: PlugMem — A Task-Agnostic Plugin Memory Module for LLM Agents

**Paper**: arXiv:2603.03296  
**Authors**: Ke Yang, Zixi Chen, Xuan He, Jize Jiang, Michel Galley, Chenglong Wang, Jianfeng Gao, Jiawei Han, ChengXiang Zhai  
**Affiliations**: UIUC (TIMAN Group) + Microsoft Research  
**Code**: https://github.com/TIMAN-group/PlugMem (53★, Apache-2.0)  
**Date**: 2025-03-05  
**Scout Rating**: ★★★★ High  

---

## Executive Summary

PlugMem is a **task-agnostic plugin memory module** for LLM agents that transforms raw episodic experience into a structured **knowledge-centric memory graph** with two node types: **propositions** (factual "knowing that") and **prescriptions** (procedural "knowing how"). Unlike entity-centric knowledge graphs (GraphRAG) or raw-text retrieval (vanilla RAG), PlugMem treats **knowledge as the fundamental unit of memory access**. It achieves SOTA across three heterogeneous benchmarks (LongMemEval, HotpotQA, WebArena) **with the same unchanged module**, outperforming both task-agnostic and task-specific baselines while using **1-2 orders of magnitude fewer memory tokens**.

**Key Result**: On LongMemEval, PlugMem achieves 75.1% accuracy (vs. 73.0% for task-specific LiCoMemory) with only 362 tokens average memory cost (vs. 5,914). That's **16x higher information density**.

---

## Architecture — Three Modules

### 1. Structuring Module (Memory → Knowledge)

**Stage 1: Standardize episodic memory** — Raw interaction traces (dialogues, documents, trajectories) are formalized into structured tuples:
```
e_t = (observation, state, action, reward, subgoal)
```
States are derived via LLM extraction; subgoals and rewards annotated by LLM conditioned on task instruction.

**Stage 2: Extract knowledge into a tri-partite memory graph:**

| Memory Type | Graph Unit | Structuring Logic |
|---|---|---|
| **Semantic** | Proposition (fact block) | Concept nodes → Proposition nodes (concept-centric) |
| **Procedural** | Prescription (workflow block) | Intent nodes → Prescription nodes (intent-centric) |
| **Episodic** | Source trace (event window) | Knowledge → Source links for verification |

Three interlinked graphs: G^E (episodic), G^S (semantic), G^P (procedural). Provenance edges maintain traceability from abstract knowledge back to raw experience.

**Semantic extraction**: LLM extracts atomic propositions with associated concept tags from each episodic unit. Includes coreference resolution and deduplication.

**Procedural extraction**: Trajectory segmented by subgoal similarity boundaries → each segment yields (intent, prescription) pair with scalar return score for quality-aware reuse.

### 2. Retrieval Module (Multi-hop Abstraction-Aware)

1. Query Q embedded → scored against low-level nodes (propositions/prescriptions)
2. At each hop, LLM generates abstract query (concepts for semantic, intents for procedural)
3. Abstract query matches high-level nodes → activates adjacent low-level nodes
4. Budget-constrained re-ranking and pruning
5. Iterates until sufficient evidence or max hops

**Key design choice**: High-level nodes (concepts, intents) serve as **routing signals only** — they're never returned as candidates. Only knowledge-level nodes (propositions, prescriptions) are retrieved.

### 3. Reasoning Module (Test-time Compression)

Aggregates and condenses retrieved memory into compact, task-aligned guidance. Removes redundancy across multiple overlapping retrieved memories. This is where the massive token savings come from.

---

## Evaluation Framework — Information-Theoretic Utility-Cost

PlugMem introduces a novel evaluation metric: **Memory Information Density** (bits/token).

```
PMI(a*; m | s) = log₂ [P_mem(a* | s, m) / P_base(a* | s)]
ρ(a*, m) = PMI(a*; m | s) / |m|
```

This measures **decision-relevant information gain per memory token** — task-agnostic and comparable across benchmarks.

---

## Results — Three Benchmarks, Same Module

### LongMemEval (Long-horizon Conversational QA)

| Method | Type | Accuracy | Avg Tokens | Info Density |
|---|---|---|---|---|
| No Context | - | 14.8% | - | - |
| All Context | - | 62.4% | 107K | 4.2e-5 |
| Vanilla Retrieval | Agnostic | 63.6% | 3,742 | 1.2e-3 |
| A-Mem | Agnostic | 61.0% | 4,225 | 1.0e-3 |
| Zep | Specific | 71.2% | 1,600 | - |
| LiCoMemory | Specific | 73.0% | 5,914 | 9.3e-4 |
| **PlugMem** | **Agnostic** | **75.1%** | **362** | **1.6e-2** |

**+2.1% accuracy over best task-specific baseline, with 16x fewer tokens and 17x higher info density.**

### HotpotQA (Multi-hop Knowledge Retrieval)

| Method | Type | EM | F1 | Avg Tokens | Info Density |
|---|---|---|---|---|---|
| Gold Context (upper bound) | - | 69.2 | 82.1 | 86.5 | 1.6e-1 |
| Vanilla Retrieval | Agnostic | 51.7 | 62.7 | 659 | 1.2e-2 |
| HippoRAG2 | Specific | 60.0 | 73.3 | 595 | 1.9e-2 |
| PropRAG | Specific | 57.8 | 72.1 | 626 | 1.9e-2 |
| **PlugMem** | **Agnostic** | **61.4** | **74.1** | **81.6** | **1.4e-1** |

**Approaches gold-context performance (74.1 vs 82.1 F1) with similar token count (81.6 vs 86.5) — ~7x fewer tokens than HippoRAG2 at higher accuracy.**

### WebArena (Interactive Web Agent Tasks)

| Method | Type | Shopping SR (on/off) | GitLab SR (on/off) | Avg Tokens | Info Density |
|---|---|---|---|---|---|
| AgentOccam | Vanilla | 42.1/43.6 | 37.8/39.2 | - | - |
| Vanilla Retrieval | Agnostic | 43.0/42.3 | 40.5/41.3 | 8,733 | 2.0e-6 |
| A-Mem | Agnostic | 44.7/44.3 | 37.8/38.5 | 20,516 | 3.4e-7 |
| AWM | Specific | 26.3/28.2 | 27.0/27.3 | 696 | -7.9e-4 |
| **PlugMem** | **Agnostic** | **52.6/58.4** | **51.4/55.2** | **301** | **1.4e-3** |

**Massive improvement: +14% SR over best baseline on Shopping-offline, with 29x fewer tokens than vanilla retrieval. AWM actually hurts performance (negative info density).**

---

## Ablation Analysis — What Matters Most

### Component contributions (all three benchmarks):

1. **Retrieval** is the **critical bottleneck** — removing it causes catastrophic degradation across all tasks
2. **Structuring** improves what can be retrieved — organized knowledge-level units enable better retrieval quality (LongMemEval: 62.8→75.1% with structuring)
3. **Reasoning** controls efficiency — reduces token usage by 1-2 orders of magnitude (LongMemEval: 9,478→362 tokens) with modest accuracy gains

**Key insight**: "Retrieval determines whether memory helps, structuring determines what can be retrieved, and reasoning determines how efficiently retrieved memory can be used."

---

## What Makes This Different from Prior Work

| Dimension | GraphRAG | A-Mem | Zep/MemoryOS | AWM | PlugMem |
|---|---|---|---|---|---|
| Memory unit | Entities/chunks | Knowledge atoms | Episodes | Workflows | Knowledge (propositions + prescriptions) |
| Memory-to-Knowledge | ✓ | ✓ | ✗ | ✓ | ✓ |
| Knowledge as Unit | ✗ | ✓ | ✗ | ✓ | ✓ |
| Supports all 3 memory types | ✗ | ✗ | ✗ | ✗ | ✓ (episodic + semantic + procedural) |
| Task-agnostic | ✓(weak) | ✓ | ✗ | ✗ | ✓ |
| Post-retrieval reasoning | ✓ | ✗ | ✗ | ✗ | ✓ |

**PlugMem is the first system that simultaneously: (1) transforms memory to knowledge, (2) uses knowledge as the unit, (3) supports all three cognitive memory types, and (4) is genuinely task-agnostic.**

---

## Architectural Implications for Our System

### Direct Relevance: Memory Architecture Design

1. **Knowledge-centric graph > entity-centric graph**: The proposition/prescription distinction is more useful for agent decision-making than entity-relation triples. Our memory system should adopt knowledge-level nodes.

2. **Tri-partite graph with provenance**: The G^E → G^S/G^P architecture with provenance links is elegant. We should maintain episodic traces for verification while operating primarily on knowledge-level representations.

3. **Concept/Intent routing**: Using high-level nodes as routing signals (not retrieval targets) is a clever pattern. Enables multi-hop retrieval without the cost of returning redundant high-level summaries.

4. **Reasoning module as compression**: Post-retrieval LLM compression yields 1-2 order-of-magnitude token savings. This is a must-have for any production memory system.

### Design Patterns to Adopt

- **Proposition extraction with concept tagging** — each fact becomes a self-contained, indexed node
- **Prescription extraction with intent hierarchy** — procedural knowledge organized by goal, not by sequence
- **Quality scoring for prescriptions** — return-based scoring enables quality-aware reuse
- **Budget-constrained multi-hop retrieval** — prevents context explosion
- **Information density as evaluation metric** — bits/token is the right way to measure memory efficiency

### Connections to Prior Scout Research

- **SSGM** (2603.11768): Governance middleware for memory — PlugMem would sit *inside* SSGM's governed memory layer
- **A-Mem** (2501.13104): PlugMem supersedes A-Mem on all three benchmarks while using similar knowledge-unit principles
- **EPOCH** (2603.09049): Procedural memory extraction aligns with EPOCH's experience accumulation
- **OpenMOSS** (GitHub): PlugMem's plugin architecture aligns with OpenMOSS's modular design philosophy

---

## Limitations & Open Questions

1. **LLM cost of structuring**: Requires LLM calls for every episodic unit (standardize + extract). Cost analysis not provided. For high-volume interaction streams, this could be expensive.

2. **Static graph**: The main evaluation covers create+retrieve. Update/delete operations are only in appendix — unclear how well the graph handles knowledge drift or contradiction.

3. **Embedding model dependency**: NV-Embed-v2 used throughout. Performance sensitivity to embedding quality not explored.

4. **Single-agent focus**: Evaluated on single-agent benchmarks. Multi-agent memory sharing (our use case) not addressed — how would propositions from Agent A be useful to Agent B?

5. **Prescription quality**: Return-based scoring is simple. In complex multi-agent settings, prescription quality might need collaborative evaluation.

---

## Bottom Line

PlugMem is the **strongest task-agnostic memory architecture** I've seen in recent papers. The cognitive science grounding (episodic → semantic/procedural), the knowledge-centric graph design, and the information-theoretic evaluation framework are all excellent. The results are convincing: SOTA across three different benchmarks with the same module, using dramatically fewer tokens. 

**For our system**: We should adopt the proposition/prescription knowledge-unit pattern and the tri-partite graph with provenance. The information density metric (bits/token) should become our standard for evaluating memory module effectiveness.

---

*Scout analysis — 2026-03-13. Source: arXiv:2603.03296v1, GitHub TIMAN-group/PlugMem.*
