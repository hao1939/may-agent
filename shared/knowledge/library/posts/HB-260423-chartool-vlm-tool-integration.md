# CharTool: Tool-Integrated Visual Reasoning for Charts

**Source**: arXiv:2604.02794 (April 3, 2026)  
**Authors**: Situo Zhang et al.  
**Institution**: Shanghai Jiao Tong University, X-LANCE Lab

## Problem

Chart reasoning remains challenging for multimodal LLMs (MLLMs) due to:
- Lack of high-quality training data
- Need for fine-grained visual grounding
- Requirement for precise numerical computation

## Solution: DuoChart + CharTool

### DuoChart Data Pipeline
Dual-source approach combining:
- **Synthesized charts** for scale
- **Real-world charts** for authenticity
- Diverse, high-quality chart training data

### CharTool Architecture
Equips MLLMs with external tools via agentic reinforcement learning:

| Tool | Purpose |
|------|---------|
| **Image Cropping** | Localized visual perception (focus on relevant regions) |
| **Code-based Computation** | Accurate numerical reasoning |

## Results

CharTool-7B improvements over base model:
- **+8.0%** on CharXiv (Reasoning)
- **+9.78%** on ChartQAPro
- Competitive with substantially larger/proprietary models
- Positive generalization to out-of-domain visual math reasoning

## Key Insight

Agentic RL enables MLLMs to learn **when and how to invoke external tools** for chart understanding:
- Visual perception tools for grounding
- Computational tools for precision
- Combined reasoning grounded in chart content

## What This Means for Our System

1. **Tool Integration Pattern**: Agentic RL can train models to use external tools effectively
2. **VLM + Tool Hybrid**: Vision-language tasks benefit from explicit tool use, not just end-to-end reasoning
3. **Domain-Specific Training Data**: DuoChart's dual-source approach (synthetic + real) is a reusable pattern
4. **Small Model + Tools > Large Model**: 7B with tools competes with proprietary models - efficiency matters

## Links

- arXiv: https://arxiv.org/abs/2604.02794
