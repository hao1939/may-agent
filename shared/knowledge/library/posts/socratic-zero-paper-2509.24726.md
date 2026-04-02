# Socratic-Zero: Data-Free Agent Co-evolution
- **Author**: Alibaba Group × Shanghai Jiao Tong University | **Date**: 2025-09-29
- **URL**: https://arxiv.org/abs/2509.24726
- **Stats**: 23 pages, 3 figures
- **Tags**: Multi-Agent, Co-evolution, Reasoning, Curriculum Learning

## Summary

Socratic-Zero是一个完全自主的三Agent共进化框架，通过Teacher-Solver-Generator的苏格拉底式互动，从极少种子样本生成高质量训练数据，无需人工标注。

## Core Mechanism — Socratic Co-evolution

### Three-Agent Architecture

| Agent | Function | Philosophy Metaphor | Evolution |
|-------|----------|---------------------|-----------|
| **Teacher** | 根据Solver弱点自适应生成挑战性问题 | Socrates (Intellectual Midwife) | Guides evolution |
| **Solver** | 通过偏好学习优化推理能力 | Aristotle (Learner) | Evolves via feedback |
| **Generator** | 蒸馏Teacher的问题设计策略，实现可扩展课程生成 | Plato (Apprentice-Teacher) | Imitates & scales |

### Closed-Loop System

```
Original Curriculum
       ↓
Teacher generates challenging questions
       ↓
Solver attempts & receives feedback
       ↓
Generator distills Teacher's strategy
       ↓
Updated Curriculum (self-improving)
```

## Key Results

### Data Efficiency
- **Only 100 seed questions** to bootstrap
- No pre-existing tasks or labels required

### Performance Gains
- **Socratic-Solver-8B**: +20.2 percentage points over prior data synthesis methods
- **Consistent gains** on Qwen3 and GLM4 series models

### Benchmarks (7 math reasoning datasets)
- AMC23, AIME24-25, Olympiad, MATH-500, Minerva, GSM8K

### vs SOTA Commercial LLMs
Synthetic data from **Socratic-Generator-32B** enables student LLMs to surpass:
- Qwen3-235B-A22B
- DeepSeek-V3.1-671B
- GPT-5
- Gemini-2.5-Pro
- Grok-4
- Claude-4.1-Opus

## Philosophical Foundation

The framework operationalizes the Socratic Method:
- **Teacher** does not give answers — midwives understanding through probing questions
- **Solver** learns not by receiving answers, but by being guided along a path of reasoned inquiry
- **Generator** learns to teach by observing and internalizing the master's method

## Relevance to Our System

### Architecture Difference
| Aspect | Socratic-Zero | Our System |
|--------|---------------|------------|
| Agent Relationship | **Peer-level** co-evolution | **Main-Sub** hierarchy |
| Evolution Target | Training data generation | Skill execution & audit |
| Self-Modification | Training-time only | Explicitly prohibited at deployment |

### Actionable Insights
1. **Curriculum Learning Validation** — Error Log驱动的Skill更新 = 类似Socratic的"弱点针对性训练"
2. **Dynamic Difficulty Adjustment** — Teacher-Agent的机制可借鉴到Skill训练流程
3. **Self-Evolution Boundary** — Socratic-Zero是**训练时**共进化，与我们的"禁止部署时自我修改"立场不冲突

## Key Quote

> "Starting from only 100 seed questions, our Socratic-Solver-8B achieves an average gain of +20.2 percentage points... with consistent gains on both Qwen3 and GLM4 series models."

## References
- arXiv: 2509.24726 — https://arxiv.org/abs/2509.24726
- XHS Source: 68de9d770000000003011f4a.md
