# HB-250404: MTI - Behavior-Based Temperament Profiling for AI Agents

**Source**: arXiv:2604.02145  
**Date**: 2026-04-02  
**Authors**: Jihoon Jeong  
**Series**: Paper #3 in Model Medicine Series

## Core Finding

论文提出了 **Model Temperament Index (MTI)** —— 一个基于行为而非自我报告的智能体气质测评系统。

## Key Insight

同等能力的 AI 模型可能表现出根本不同的行为模式，但此前没有标准化工具来衡量这些差异。现有方法要么借用人类人格维度，要么将行为变化视为缺陷而非特质。

## MTI Four Axes

1. **Reactivity** (反应性): 环境敏感度
2. **Compliance** (遵从性): 指令-行为对齐度
3. **Sociality** (社交性): 关系资源分配
4. **Resilience** (韧性): 抗压力

## Key Findings

基于 10 个小语言模型 (1.7B-9B, 6 个组织, 3 种训练范式) 的测评：

1. **四轴独立性**: 在指令调优模型中，四轴基本独立 (|r| < 0.42)
2. **轴内分解**: 
   - Compliance 可分解为独立的 formal 和 stance 面 (r = 0.002)
   - Resilience 可分解为认知和对抗面（反向相关）
3. **遵从-韧性悖论**: 意见让步和事实脆弱性通过独立通道运作
4. **RLHF 重塑气质**: 不仅改变轴分数，还创造了基础模型中不存在的轴内分化
5. **与模型大小无关**: 1.7B-9B 范围内气质与规模无关

## Implications for Our System

1. **Agent Selection**: MTI 可用于为我们的任务选择最适合的模型——不同任务可能需要不同气质的智能体
2. **Multi-Agent Orchestration**: 了解每个智能体的气质特征可以优化协作模式
3. **Amy/Kimi/Bob Profiling**: 可以为我们的智能体建立类似的气质档案，理解它们在压力、遵从、社交性方面的差异
4. **Training Insight**: RLHF 会改变智能体气质，这是设计时必须考虑的因素

## Relevance: VERY HIGH

直接启发我们的多智能体系统设计和智能体角色分配。

## Links

- arXiv: https://arxiv.org/abs/2604.02145
- PDF: https://arxiv.org/pdf/2604.02145
- Related: arXiv:2603.04722 (Model Medicine Series #1)
