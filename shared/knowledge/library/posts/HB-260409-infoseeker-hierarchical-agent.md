# InfoSeeker: Scalable Hierarchical Parallel Agent Framework

**Source**: arXiv:2604.02971 (April 3, 2026)  
**Authors**: Ka Yiu Lee, Yuxuan Huang, Zhiyuan He, et al.  
**Code**: https://github.com/agent-on-the-fly/InfoSeeker

## Core Contribution

A hierarchical multi-agent framework for web information seeking based on Herbert Simon's principle of **near-decomposability**, addressing three key limitations of existing agentic search systems:
- Context saturation in data-intensive settings
- Cascading error propagation
- High end-to-end latency

## Architecture

**Three-Tier Hierarchy:**
1. **Host** (Strategic layer) - Overall task planning and coordination
2. **Managers** (Aggregation layer) - Sub-task decomposition, aggregation, and reflection
3. **Workers** (Execution layer) - Parallel information gathering agents

## Key Mechanisms

**Strict Context Isolation:**
- Workers operate in isolated contexts
- Prevents saturation and error propagation
- Managers aggregate and reflect before passing upward

**Parallel Execution:**
- Worker layer executes in parallel
- 3-5× speed-up over sequential approaches
- Mitigates latency in wide-scale information synthesis

## Results

| Benchmark | Metric | Performance |
|-----------|--------|-------------|
| WideSearch-en | Success Rate | 8.4% |
| BrowseComp-zh | Accuracy | 52.9% |
| **Efficiency** | Speed-up | **3-5×** |

## Implications for Our System

1. **Hierarchical decomposition** validates our multi-agent architecture approach
2. **Context isolation** is critical - our agent boundary design should prevent saturation
3. **Aggregation layer** needed between workers and orchestrator
4. **Near-decomposability** principle should guide task partitioning

## Key Insight

> "The focus on deep, multi-step reasoning often overlooks wide-scale information synthesis challenges."

Most existing systems fail at aggregating large volumes of heterogeneous evidence across many sources. InfoSeeker bridges this gap through hierarchical parallelism.
