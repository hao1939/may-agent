# HiCrew: Hierarchical Multi-Agent for Long-Form Video Understanding

**Source**: arXiv:2604.21444 (April 23, 2026)  
**Authors**: Yuehan Zhu, Jingqi Zhao, Jiawen Zhao, Xudong Mao, Baoquan Zhao (Chinese team)  
**Tags**: #multi-agent #video-understanding #hierarchical-reasoning #question-aware

---

## Core Problem

Long-form video understanding faces two fundamental challenges:

1. **Spatiotemporal redundancy**: Videos contain massive redundant information
2. **Intricate narrative dependencies**: Causal relationships span extended temporal horizons

Existing approaches fail because:
- Structured representations compress visual info but **sacrifice temporal coherence**
- Multi-agent frameworks use **rigid pre-defined workflows** that don't adapt to question-specific demands

---

## HiCrew: Three Core Contributions

### 1. Hybrid Tree Structure

```
Video Input
    ↓
Shot Boundary Detection → Preserves temporal topology
    ↓
Relevance-Guided Hierarchical Clustering
    ↓
Semantically Coherent Segments
```

- **Shot boundary detection**: Maintains temporal structure
- **Hierarchical clustering**: Groups related content
- **Relevance guidance**: Focuses on question-relevant segments

### 2. Question-Aware Captioning

- Synthesizes **intent-driven visual prompts**
- Generates **precision-oriented semantic descriptions**
- Adapts captioning to specific question needs

### 3. Planning Layer (Dynamic Orchestration)

| Question Complexity | Agent Role Selection | Execution Path |
|--------------------|---------------------|----------------|
| Simple | Single agent | Direct retrieval |
| Moderate | Specialist agents | Parallel analysis |
| Complex | Full crew | Hierarchical reasoning |

**Adaptive collaboration**: Roles and paths selected based on question complexity, not fixed workflow.

---

## Experimental Results

**Datasets**: EgoSchema, NExT-QA

**Key Findings**:
- Strong performance across **diverse question types**
- **Pronounced gains** in temporal and causal reasoning tasks
- Benefits from **hierarchical structure-preserving design**

---

## Architecture Patterns

### Hybrid Tree vs Flat Processing

| Approach | Temporal Coherence | Redundancy Handling | Scalability |
|----------|-------------------|---------------------|-------------|
| **Flat** | Poor (lossy compression) | Uniform treatment | Limited |
| **Hybrid Tree** | **Preserved** | **Relevance-guided** | **Hierarchical** |

### Rigid vs Dynamic Workflows

| Workflow | Adaptability | Question Optimization | Resource Efficiency |
|----------|-------------|---------------------|---------------------|
| **Pre-defined** | None | Generic | Wasteful |
| **Planning Layer** | **Dynamic** | **Question-aware** | **Optimal** |

---

## Implications for Agent Systems

### Hierarchical Task Decomposition

HiCrew's three-layer architecture:
```
Planning Layer        →  Dispatcher role selection
Hybrid Tree          →  Task structure preservation  
Question-Aware       →  Intent-driven processing
```

### Multi-Agent Collaboration Patterns

1. **Adaptive role selection**: Assign agents based on task complexity
2. **Dynamic execution paths**: Route through different agent combinations
3. **Structure preservation**: Maintain task dependencies during decomposition

### Temporal Reasoning

For long-horizon agent tasks:
- **Shot boundary detection** → Phase/chapter identification
- **Hierarchical clustering** → Related subtask grouping
- **Temporal topology** → Dependency preservation

---

## Critical Insight

> "Existing multi-agent frameworks operate through rigid, pre-defined workflows that fail to adapt their reasoning strategies to question-specific demands."

**HiCrew's solution**: Planning Layer that dynamically orchestrates collaboration by adaptively selecting roles and execution paths based on question complexity.

---

## Chinese AI Research Context

This work represents continued strong contributions from Chinese research teams to multi-agent systems:
- Dynamic workflow adaptation
- Structure-preserving hierarchical processing
- Question-aware agent orchestration

Aligns with broader trends in AgentScope (Alibaba), verl (ByteDance), and other Chinese open-source agent frameworks.

---

## Rating: ★★★★☆

**Why it matters**: Demonstrates that dynamic, question-aware multi-agent orchestration outperforms rigid workflows. Structure-preserving hierarchical design is key for temporal/causal reasoning.

**Limitations**: Evaluated on video understanding; generalization to other long-horizon tasks needs validation.

---

## References

- arXiv:2604.21444 [cs.AI]
- EgoSchema, NExT-QA benchmarks
