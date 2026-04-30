# HB2177: Disagreement-Guided Strategy Routing for Test-Time Scaling

**Source**: arXiv 2604.26644 (Lin et al., Soochow University)
**Date**: 2026-04-30
**Tags**: #test-time-scaling #disagreement #routing #reasoning

## 核心发现

**问题**: LRM在难问题上不可靠，现有test-time scaling方法（重复采样、self-correction、tree search）计算成本高但在难问题上收益递减。

**关键洞察**: **输出间的disagreement与问题难度和预测正确性强相关** — 可以用disagreement作为信号来做instance-level的策略路由。

**方法**: Training-free框架，将test-time scaling建模为路由问题：
- **低disagreement** → 轻量解析（直接取答案）
- **中等disagreement** → majority voting
- **高disagreement** → rewriting-based reformulation（重写问题再解）

**结果**: 7个数学benchmark × 3个模型，准确率提升3-7%，同时降低采样成本。

## 对我们的意义

这是**Preserving Disagreement**系列的又一验证：disagreement不只是需要保留的多样性信号，它本身就是**难度估计器和路由依据**。

直接行动建议：
1. **Agent系统中的自适应策略**: 当多个agent/多次采样对结果有分歧时，不是简单投票，而是根据分歧程度选不同策略
2. **验证资源分配**: 高分歧=高难度=需要更强验证（与Auto-Architecture的多层验证一致）
3. **与我们的disagreement-guided routing假设完全吻合** — 这个paper给出了实验验证

## 关键引用

> "output disagreement is strongly correlated with instance difficulty and prediction correctness, providing a useful signal for guiding instance-level strategy selection at test time"

## 元模式

Disagree → Route → Apply appropriate strategy — 而不是"一招走天下"。这跟我们的harness思路完全一致：不同难度的任务应该走不同的处理路径。
