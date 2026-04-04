# Synthesis #001: Agent Memory Architecture — From 8 Strategies to Memory OS

> **Cross-cutting synthesis of 50+ sources** from our research library
> Created: 2026-04-06 | Author: May (knowledge compilation)
> Sources: HB-0043, HB-0045, HB-1497, HB-1721, HB-0502, HB-250403, HB-0504, HB-0511, HB-2602, HB-250405, BACKFILL-007, + 40 community posts

---

## Executive Summary

Agent memory is the **single most-discussed topic** in our research library (50+ posts). The field has rapidly evolved from "just use RAG" to sophisticated tiered architectures that mirror computer memory hierarchies. This synthesis distills the key patterns, frameworks, and open problems.

**Bottom line**: Production agent memory requires a **hybrid layered approach** — no single strategy works. The frontier is moving from passive storage to **active, self-evolving memory with forgetting**.

---

## 1. The Memory Strategy Landscape

From the community's comprehensive mapping (HB-0045, 682 likes / 1155 collects):

| # | Strategy | Mechanism | When to Use | Limitation |
|---|----------|-----------|-------------|------------|
| 1 | **Full Memory** | Store everything | Tiny context, low stakes | Window exhaustion |
| 2 | **Sliding Window** | Keep last N turns | Simple chatbots | Loses early context |
| 3 | **Relevance Filter** | Score & keep important | Medium conversations | Scoring accuracy |
| 4 | **Summary Compression** | LLM summarizes | Long conversations | Detail loss |
| 5 | **Vector DB** | Embed & retrieve by similarity | Large knowledge bases, RAG | Semantic gaps |
| 6 | **Knowledge Graph** | Structured entity relations | Complex domains | Construction cost |
| 7 | **Hierarchical Memory** | Working + semantic + long-term | Production systems | Design complexity |
| 8 | **OS-like Management** | Pages, eviction, scheduling | Enterprise-scale | Engineering effort |

**Community consensus**: Production systems should target Strategy 7 (Hierarchical) minimum, with Strategy 8 (OS-like) as the aspirational target.

---

## 2. The Three-Layer Architecture (Dominant Pattern)

Multiple independent sources converge on a three-layer memory model:

```
┌─────────────────────────────────────────────┐
│       Layer 1: Working Memory               │
│  Current context, tool calls, session state  │
│  ← Fast, volatile, capacity-limited         │
├─────────────────────────────────────────────┤
│       Layer 2: Semantic Memory              │
│  Session summaries, entity facts, skills    │
│  ← Medium persistence, semantic retrieval   │
├─────────────────────────────────────────────┤
│       Layer 3: Long-term Knowledge          │
│  Distilled insights, user models, rules     │
│  ← Persistent, structured, slow to change   │
└─────────────────────────────────────────────┘
```

**Sources**: HB-0043 (三层记忆架构), HB-1497 (computer architecture perspective), HB-1721 (MemOS), BACKFILL-007

### Computer Architecture Analogy (HB-1497, UCSD/Georgia Tech)

| Agent Layer | Hardware Analog | Characteristics |
|-------------|-----------------|-----------------|
| Working Memory | L1/L2 Cache | Fast, small, volatile |
| Semantic Memory | DRAM | Medium speed, structured |
| Long-term Knowledge | Storage/SSD | Slow, persistent, large |

**Key insight**: "Agent performance is an end-to-end data movement problem. If relevant information is stuck in the wrong layer (or never loaded), reasoning accuracy and efficiency degrade."

---

## 3. Memory Retrieval: The Real Bottleneck

### Semantic Retrieval (+40% efficiency)
The tiered architecture claims (HB-0043) show **40% improvement** in retrieval efficiency through semantic-aware methods over keyword matching.

### Hybrid Search (OpenClaw pattern)
From reverse-engineering (BACKFILL-007):
- **70/30 split**: Vector similarity (70%) + BM25 keyword (30%)
- **Mandatory pre-search**: System prompt forces "run memory_search before answering"
- **Parameters**: top_k=8-15, threshold=0.22-0.28 (HB-0502)

### Proactive Retrieval (ProMem, NJU)
HB-0511 introduces a paradigm shift — from passive recall to **active questioning**:
- Agent generates questions about what it might need
- Iteratively probes conversation history
- Can recover missed information and correct errors
- Trade-off: Higher quality but more tokens

---

## 4. The Forgetting Problem

**Uncontrolled accumulation is the #1 failure mode** in long-horizon agents.

### Evidence (HB-250403, arXiv:2604.02280)
- LOCOMO benchmark: Performance drops from 0.455 → 0.05 across dialogue stages
- MultiWOZ: 78.2% accuracy but 6.8% false memory rate under persistent retention

### Adaptive Budgeted Forgetting Framework
Three-factor scoring for what to forget:

| Factor | Weight | Description |
|--------|--------|-------------|
| **Recency** | Configurable | Time since last access |
| **Frequency** | Configurable | How often accessed |
| **Semantic relevance** | Configurable | Similarity to current context |

Result: LOCOMO F1 > 0.583 with false memory reduction.

### Community Wisdom
OpenClaw stability principle (BACKFILL-010): **"Memory via distillation, not accumulation"** — persona drift is 90% caused by memory compaction gone wrong.

---

## 5. Self-Evolving Memory (The Frontier)

### MemSkill (arXiv:2602.02474, HB-2602)
Reframes memory operations as **learnable skills** rather than fixed procedures:
- Controller-Executor-Designer architecture
- Memory extraction, consolidation, and pruning as evolvable routines
- 806 likes on XHS — high community resonance

### Memento-Skills (HB-250405)
External skill notebook for continuous learning without fine-tuning:
- Read-Write loop: Retrieve relevant skills → Execute → Store new skills
- Physics/Biology/Math: +116% relative improvement
- Zero parameter modification required

### OmniMem (arXiv:2604.01007, HB-0504)
Autonomous research pipeline discovering optimal memory architectures:
- LoCoMo: +411% F1 improvement
- **Critical finding**: Bug fixes (+175%) > Architecture changes (+44%) >> Hyperparameter tuning
- Implication: Get the basics right before optimizing

### MemOS (arXiv:2507.03724, HB-1721)
40+ author milestone paper treating memory as **schedulable system resource**:
- Unifies plaintext/activation/parameter memory in one OS
- MemCube units with identity, permissions, lifecycle
- Memory can "upgrade": notes → cache → parameters
- Cross-platform migration — breaking memory silos

---

## 6. Shared vs Distributed Memory in Multi-Agent Systems

| Model | Mechanism | Pros | Cons |
|-------|-----------|------|------|
| **Shared** | All agents access shared pool | Easy knowledge reuse | Coherence issues, overwrites |
| **Distributed** | Each agent owns local memory | Isolation, scalability | State divergence |
| **Hybrid** | Shared specs + local working memory | Balance | Design complexity |

**OpenClaw's approach** (HB-1747, 2776 likes): MEMORY.md as shared index (always loaded) + per-member memory files loaded on demand. ~2-3M tokens/day for 8-person team.

### Memory vs Skill Distinction (HB-1747)

| Dimension | Memory | Skill |
|-----------|--------|-------|
| Management | Agent self-manages | User designs |
| Loading | Dynamic on-demand | Static declaration |
| Lifecycle | Long-term persistent | Task-triggered |
| User intervention | None needed | Explicit invocation |

---

## 7. Practical Implementation Guide

### For Our System (OpenClaw-style)

**Current state**: File-based memory (MEMORY.md, context.md, knowledge/), session compaction
**Gaps identified from this research**:

1. **No semantic retrieval** — We use file reads, not vector search
2. **No forgetting mechanism** — Files grow unbounded
3. **No proactive retrieval** — Agents don't self-question before acting
4. **No memory-skill distinction** — Everything is a file

### Recommended Evolution Path

```
Phase 1 (Now): File-based with distillation
  - MEMORY.md + context.md + knowledge/ directories
  - Manual curation (what we do today)
  
Phase 2 (Near): Add semantic retrieval + forgetting
  - Implement relevance scoring for context loading
  - Auto-archive stale entries (>30 days untouched)
  - Summary distillation for long files
  
Phase 3 (Future): Self-evolving memory
  - MemSkill-style learnable memory operations
  - Proactive retrieval (ProMem pattern)
  - Cross-agent memory sharing with coherence
```

---

## 8. Key Takeaways

1. **Three-layer hierarchy is consensus** — Working/Semantic/Long-term, mirroring CPU cache/DRAM/storage
2. **Forgetting is as important as remembering** — Uncontrolled accumulation kills performance
3. **Distillation > Accumulation** — Compress and refine, don't just append
4. **Semantic retrieval matters** — 40% efficiency gain over keyword matching
5. **Memory operations should be learnable** — Not hard-coded procedures
6. **Bug fixes > Architecture > Hyperparameters** — Get basics right first (OmniMem finding)
7. **File-based memory works** — OpenClaw proves it at scale with md files
8. **The frontier is Memory OS** — Treating memory as schedulable, upgradeable system resource

---

## Source Index

| ID | Title | Type | Key Contribution |
|----|-------|------|-----------------|
| HB-0043 | Agent Memory Paradigm | Community post | Three-layer architecture definition |
| HB-0045 | 8 Memory Strategies | Community post | Comprehensive strategy landscape |
| HB-1497 | Multi-Agent Memory (UCSD) | Academic paper | Computer architecture framing |
| HB-1721 | MemOS | Academic paper | Memory as OS resource |
| HB-0502 | OpenClaw Memory Philosophy | Community post | File-based memory validation |
| HB-250403 | Memory Forgetting | Academic paper | Adaptive budgeted forgetting |
| HB-0504 | OmniMem | Academic paper | Autonomous memory architecture search |
| HB-0511 | ProMem | Academic paper | Proactive memory retrieval |
| HB-2602 | MemSkill | Academic paper | Learnable memory operations |
| HB-250405 | Memento-Skills | Academic paper | Zero-finetune continuous learning |
| HB-1747 | OpenClaw Memory (ByteDance) | Community post | Production memory patterns |
| HB-0179 | Memory Frameworks 2025 | Community post | Framework comparison |
| BACKFILL-007 | Multi-Agent Memory Architecture | Synthesis | 8-strategy deep dive |

---

*This is Synthesis #001 in our knowledge compilation series. Each synthesis distills a major topic cluster from our 200+ post research library into actionable insights.*
