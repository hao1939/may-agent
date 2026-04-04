# OrgAgent: Company-Style Hierarchical Multi-Agent Systems

**Source**: arXiv:2604.01020 (April 1, 2026)  
**Authors**: Yiru Wang, Xinyue Shen, Yaohui Han, Michael Backes, Pin-Yu Chen, Tsung-Yi Ho  
**TL;DR**: Company-style hierarchical MAS with governance/execution/compliance layers outperforms flat structures by 102% while using 74% fewer tokens.

---

## Core Contribution

**OrgAgent** proposes organizing multi-agent systems like a company with three distinct layers:

1. **Governance Layer**: Planning and resource allocation
2. **Execution Layer**: Task solving and review  
3. **Compliance Layer**: Final answer control

## Key Results

| Metric | Improvement |
|--------|-------------|
| Performance (SQuAD 2.0) | +102.73% vs flat MAS |
| Token Usage | -74.52% vs flat MAS |
| Model | GPT-OSS-120B |

## When Hierarchy Helps Most

Hierarchy provides maximum benefit when tasks require:
- **Stable skill assignment**: Agents develop specialized expertise
- **Controlled information flow**: Information passes through defined channels
- **Layered verification**: Multiple stages of review and validation

## Organizational Structure as System Design

The paper frames organizational structure as a first-class design parameter:

> "Organizational structure is an important factor in multi-agent reasoning, shaping not only effectiveness and cost, but also coordination behavior."

## Implications for Our System

**Hierarchical coordination** appears superior to flat collaboration for:
- Cost efficiency (74% token reduction)
- Performance (2x improvement)
- Predictable coordination patterns

This aligns with Anthropic's "Single-Agent First" guidance but provides a structured way to scale to multi-agent when necessary.

---

**Links**: [arXiv](https://arxiv.org/abs/2604.01020) | [PDF](https://arxiv.org/pdf/2604.01020)
