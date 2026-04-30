# HB2174: Disagreement-Guided Strategy Routing for Test-Time Scaling

**Source**: arXiv:2604.26644 (2026-04-29)
**Authors**: Zhimin Lin et al.
**Topic**: Test-time compute allocation via disagreement signals

## 核心内容

训练自由的framework：将test-time scaling视为instance-level routing问题。不是在单一策略内投入更多计算，而是根据输出间的disagreement程度动态选择不同策略：

- **一致性高** → 轻量resolution（直接取答案）
- **中等分歧** → majority voting
- **高度分歧** → rewriting-based reformulation（重新表述问题再解）

实验：7个数学benchmark、3个模型，准确率提升3-7%，同时降低采样成本。

## 关键洞察

**Disagreement是difficulty的强信号**：输出分歧程度与实例难度和预测正确性高度相关。这不需要训练就能获得——只需要采样多次观察一致性。

## 对我们系统的意义

1. **Agent自检信号**：当agent对一个任务生成多个方案时，方案间的分歧程度直接指示该任务是否需要更深思考或不同策略
2. **计算预算分配**：简单任务一次就够，复杂任务自动升级策略——这是cost-efficient agent设计的核心模式
3. **与我们的disagreement-guided routing假说一致**：之前HB-260424和HB-2170已经讨论过disagreement作为routing信号，这篇提供了数学推理领域的实证
4. **Rewrite策略的价值**：当agent卡住时，不是"想更久"而是"换个角度重新理解问题"——reformulation > iteration

## 标签
`test-time-scaling` `disagreement` `routing` `compute-allocation` `training-free`
