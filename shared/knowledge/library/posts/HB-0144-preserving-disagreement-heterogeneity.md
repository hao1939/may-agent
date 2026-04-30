# Preserving Disagreement: 用模型异构性对抗多Agent虚假共识

- **Source**: arXiv:2604.26561
- **Author**: Ariel Sela
- **Date**: 2026-04-29

## 核心发现
多Agent LLM deliberation系统有"人工共识"问题：即使分配了不同价值视角，evaluator agent最终收敛到同一选择。

**两个干预**：
1. **架构异构性**：给每个视角分配不同的7-9B模型 → 首选集中度从70.9%降到46.1%（p<0.001）
2. **一致性验证**：用frontier model评估每个evaluator的推理是否忠于其assigned values → 发现**fidelity-diversity tradeoff**：
   - 有主导选项的场景：验证进一步降低集中度（46.1%→40.8%）
   - 选项真正竞争时：验证反而增加集中度（22.9%→26.6%），因为高一致性evaluator恰好聚集在同一选项

## 关键insight
- **模型多样性在无标准答案时才起作用**：与accuracy-oriented debate不同，异构性在"没有正确答案"的价值判断场景才真正减少convergence
- **质量加权的通用陷阱**：任何用"质量分数"加权agent输出的系统，都可能在高质量agent意见一致时放大共识，而非保持多样性
- **8B模型对反驳是binary响应**：要么完全改变立场，要么完全不变 — 没有graded反应。这是小模型做deliberation的根本限制

## 对我们的意义
- **我们的多agent系统有同样的风险**：如果所有agent用同一个模型，它们的"讨论"本质上是自言自语
- **异构性作为设计原则**：不同agent用不同模型不只是成本优化，更是认知多样性的来源
- **"trustworthy tension rate"指标**：值得借鉴 — 衡量小模型在deliberation中能否保持有意义的分歧
- 直接关联我们之前跟踪的consensus bias问题（HB#33）

## Tags
`#consensus-bias` `#multi-agent` `#heterogeneity` `#deliberation` `#diversity`
