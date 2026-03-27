# HB#1484 — PlugMem: Task-Agnostic Plugin Memory Module

**Source**: arXiv:2603.03296 (UIUC/Microsoft/UMass) — Direct Paper Tracking  
**Archive Date**: 2026-03-15  
**GitHub**: https://github.com/TIMAN-group/PlugMem

---

## Core Problem: Memory Design Dilemma

Existing memory designs face a fundamental trade-off:

| Type | Transferability | Effectiveness | Problem |
|------|----------------|---------------|---------|
| **Task-Specific** | ❌ Non-transferable | ✅ High relevance | Each task needs redesign |
| **Task-Agnostic** | ✅ General | ❌ Low relevance | Raw retrieval = context explosion |

## PlugMem Solution: Knowledge-Centric Memory Graph

### Key Innovation

> "Decision-relevant information is concentrated as abstract knowledge rather than raw experience"

**Departure from GraphRAG**: Treats **knowledge** (not entities/text chunks) as the unit of memory access.

### Three-Module Architecture

```
Raw Episodic Memory
    ↓
[Structuring Module] → Knowledge Graph (Propositions + Prescriptions)
    ↓
[Retrieval Module] → Task-relevant subgraph selection
    ↓
[Reasoning Module] → Compressed, actionable guidance
    ↓
Base Agent Decision
```

### Cognitive Science Foundation

| Memory Type | Graph Unit | Structure |
|-------------|------------|-----------|
| **Episodic** | Source Trace (Event Window) | Ground truth anchor |
| **Semantic** | Proposition (Fact Block) | Concept ←mentions→ Proposition |
| **Procedural** | Prescription (Workflow Block) | Intent ←solves→ Prescription |

### Information Density Framework

**Definition**: Decision-relevant information gain per memory token

Combines:
- PMI (Pointwise Mutual Information) for utility
- Token length for cost
- Enables cross-task comparison

## Experimental Validation

Three heterogeneous benchmarks (same PlugMem implementation):

| Benchmark | Domain | Result |
|-----------|--------|--------|
| LongMemEval | Long-horizon conversation | Outperforms task-agnostic baselines |
| HotpotQA | Multi-hop knowledge retrieval | Exceeds task-specific designs |
| WebArena | Web agent tasks | Highest information density |

**Key Finding**: Task-agnostic design can surpass task-specific approaches when knowledge abstraction is done right.

---

## OpenClaw Validation

### 1. Error Log → Knowledge Graph Evolution Path

| Current | PlugMem Inspired Future |
|---------|------------------------|
| Markdown format | Structured JSON |
| Raw episodic traces | Propositional/prescriptive abstraction |
| Text search retrieval | Semantic + hierarchical retrieval |
| Passive documentation | Active decision-support knowledge |

### 2. Memory Information Density → Skill Evaluation

PlugMem's information density metric directly applicable:
- **High density**: AGENTS.md (passive context) — few tokens, high decision value
- **Low density**: Verbose raw logs — many tokens, scattered relevance

### 3. Three-Module Architecture Mapping

| PlugMem | OpenClaw |
|---------|----------|
| Structuring Module | Skill input standardization + Error Log processing |
| Retrieval Module | Context Engine (Qdrant + semantic search) |
| Reasoning Module | LLM reasoning with condensed context |

### 4. Cross-Validation Network

| Prior Work | PlugMem Relationship |
|------------|---------------------|
| HB#1478 XSkill | Experience + Skills separation validated |
| SYNTH-006 Layered Knowledge | Three-layer management confirmed |
| Mem0 community practice | Task-agnostic plugin architecture validated |

---

## Key Insights

### For OpenClaw Design

1. **Error Log 2.0**: Current markdown format is episodic-heavy. Future: structured knowledge extraction.

2. **Skill Evaluation**: Information density should be a first-class metric — tokens spent vs decision value gained.

3. **Knowledge vs Entity**: GraphRAG's entity-centric approach may be suboptimal for agent memory — knowledge units are more actionable.

### Critical Distinctions

| Concept | Traditional | PlugMem Approach |
|---------|-------------|------------------|
| Memory unit | Text chunks / Entities | Knowledge (propositions/prescriptions) |
| Retrieval goal | Similarity match | Decision relevance |
| Success metric | Recall/Precision | Information density |

---

## L3 Flags

- #1484-A: Evaluate Error Log format evolution toward structured knowledge extraction
- #1484-B: Research information density metrics for Skill evaluation
- #1484-C: Explore knowledge-graph-based Skill relationship mapping

---

*Last updated: 2026-03-15*
