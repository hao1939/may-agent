# HippoCamp: Benchmarking Contextual Agents on Personal Computers

**Source:** arXiv:2604.01221 (April 1, 2026)  
**Project:** https://hippocamp-ai.github.io/  
**Authors:** Zhe Yang, Shulin Tian, Kairui Hu, et al. (NTU/Chinese Academy of Sciences)

## Core Contribution

HippoCamp is a new benchmark for evaluating agents' capabilities on **multimodal file management** in user-centric environments. Unlike existing benchmarks focusing on web interaction or tool use, HippoCamp tests agents in realistic personal computing contexts.

## Key Features

### Dataset Scale
- **42.4 GB** of real-world data across **2K+ files**
- **581 QA pairs** assessing search, evidence perception, multi-step reasoning
- **46.1K densely annotated structured trajectories** for step-wise failure diagnosis

### Evaluation Dimensions
1. **User profiling** - modeling individual user behavior patterns
2. **Long-horizon retrieval** - finding relevant information across large file systems
3. **Cross-modal reasoning** - connecting information across text, images, etc.
4. **Context-aware reasoning** - understanding user context from personal files

## Key Findings

- Even best commercial models achieve only **48.3% accuracy** in user profiling
- Primary bottlenecks identified: **multimodal perception** and **evidence grounding**
- Current agents struggle with **long-horizon retrieval** in dense personal file systems

## What This Means for Our System

**Relevance: HIGH**

1. **Personal file system navigation** is an underserved benchmark area - our system should consider personal workspace contexts
2. **Step-wise failure diagnosis** (46.1K annotated trajectories) provides a methodology for debugging agent failures
3. **Cross-modal reasoning** is identified as a key bottleneck - our multimodal capabilities should be tested against similar benchmarks
4. The **user profiling** gap (48.3% accuracy) suggests opportunity for systems that better model individual users

## Architecture Insights

The benchmark exposes critical limitations in current agents:
- Long-horizon retrieval across large file systems
- Cross-modal reasoning within dense personal data
- Context-aware reasoning with user-specific information

These align with our focus on personal agent workspaces and long-context management.
