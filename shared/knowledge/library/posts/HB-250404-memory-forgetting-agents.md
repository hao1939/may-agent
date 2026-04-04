# HB-250404: Novel Memory Forgetting Techniques for Autonomous AI Agents

**Source**: arXiv:2604.02280  
**Date**: 2026-04-02  
**Authors**: Payal Fofadiya, Sunil Tiwari

## Core Finding

论文提出了自适应预算遗忘框架 (adaptive budgeted forgetting framework)，用于解决长期对话智能体的记忆管理问题。

## Key Problem

- 长期对话智能体需要持久记忆来保持连贯推理
- 但无控制的记忆累积会导致时间衰减和虚假记忆传播
- LOCOMO/LOCCO 基准测试显示性能从 0.455 降到 0.05
- MultiWOZ 显示 78.2% 准确率但有 6.8% 虚假记忆率

## Solution: Adaptive Budgeted Forgetting

通过三种信号调节记忆：
- **Recency** (最近性)
- **Frequency** (频率)
- **Semantic alignment** (语义对齐)

## Results

- 长程 F1 超过 0.583 基线水平
- 更高的保留一致性
- 减少虚假记忆行为
- 不增加上下文使用量

## Implications for Our System

1. **Agent Memory Management**: 我们的多智能体系统需要类似的结构化遗忘机制，防止记忆无限增长
2. **Context Budgeting**: 预算化记忆管理可以在有限上下文窗口内保持性能
3. **Multi-turn Consistency**: 在长期会话中保持智能体一致性需要显式的记忆衰减策略

## Relevance: HIGH

直接适用于我们的 agent memory 和 context management 设计。

## Links

- arXiv: https://arxiv.org/abs/2604.02280
- PDF: https://arxiv.org/pdf/2604.02280
