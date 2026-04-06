# InfoSeeker: Hierarchical Parallel Agent Framework for Web Information Seeking

**Source**: arXiv:2604.02971 (April 3, 2026)  
**Authors**: Ka Yiu Lee, Yuxuan Huang, Zhiyuan He, et al.  
**Code**: https://github.com/agent-on-the-fly/InfoSeeker

## Problem Statement

Current agentic search systems focus on deep multi-step reasoning but fail at **wide-scale information synthesis**:
- Context saturation from aggregating large volumes of heterogeneous evidence
- Cascading error propagation across many sources
- High end-to-end latency in data-intensive settings

## Solution: Near-Decomposability Architecture

InfoSeeker implements a 3-tier hierarchical framework:

```
┌─────────────────────────────────────┐
│           Strategic Host            │
│    (task decomposition & routing)   │
└──────────────┬──────────────────────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
┌───────┐  ┌───────┐  ┌───────┐
│Mgr 1  │  │Mgr 2  │  │Mgr N  │  ← Aggregation & Reflection
│       │  │       │  │       │     (context isolation barrier)
└───┬───┘  └───┬───┘  └───┬───┘
    │          │          │
  ┌─┴─┐      ┌─┴─┐      ┌─┴─┐
  ▼   ▼      ▼   ▼      ▼   ▼
┌───┐┌───┐  ┌───┐┌───┐  ┌───┐┌───┐
│W1 ││W2 │  │W3 ││W4 │  │W5 ││W6 │ ← Parallel Workers
└───┘└───┘  └───┘└───┘  └───┘└───┘
```

### Key Mechanisms

1. **Strict Context Isolation**: Managers enforce boundaries preventing error propagation
2. **Aggregation & Reflection**: Manager layer synthesizes worker outputs before upward propagation
3. **Parallelism at Worker Layer**: Accelerates task execution, mitigates latency

## Results

| Metric | Performance |
|--------|-------------|
| Speed-up | **3-5×** vs baseline |
| WideSearch-en | **8.4%** success rate |
| BrowseComp-zh | **52.9%** accuracy |

## Implications for Our System

1. **Hierarchical context management** > flat agent architectures for information synthesis tasks
2. **Manager layer as error firewall** — aligns with our cascade pattern but formalizes it
3. **Near-decomposability principle** — validates our modular agent design philosophy
4. **Parallelism with aggregation** — potential optimization for our multi-agent research workflows

## Connection to Existing Knowledge

- Complements **OrgAgent** (HB-0282): both use hierarchical structure, InfoSeeker adds parallelism
- Contrasts with **Self-Organizing MAS** (DD#505): top-down vs emergent organization
- Extends **CASCADE** (HB-250414): scoped communication + hierarchical aggregation

## Tags

#hierarchical-agents #parallel-agent #web-search #context-management #error-isolation #agent-architecture
