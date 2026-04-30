# HB2176: Preserving Disagreement — AI Council Multi-Agent Deliberation

**Source**: arXiv:2604.26561 (2026-04-29)
**Authors**: Ariel Sela
**Topic**: Preventing artificial consensus in multi-agent policy deliberation

## 核心内容

问题：用LLM做多agent讨论时，agents会**人工收敛**——不管assigned什么立场，最终都选同一个选项。

解法（AI Council三阶段框架）：
1. **Architectural heterogeneity**：给每个价值立场分配不同的7-9B模型 → 显著降低first-choice集中度（70.9% → 46.1%）
2. **Coherence validation**：用frontier model评估每个evaluator的推理是否忠于其assigned价值观

关键发现：
- **模型多样性在无正确答案时有效**：与accuracy-oriented debate不同，当问题没有客观正确答案时，heterogeneity才能减少convergence
- **Fidelity-diversity tradeoff**：coherence validation有时反而增加集中度——高coherence的evaluators可能恰好聚集在同一选项
- **8B模型对反驳呈binary反应**：要么完全接受要么完全拒绝，无法做graded response

## 对我们系统的意义

1. **多agent系统的核心警告**：如果用同一个模型扮演多个角色，"讨论"就是假的——它们会自然收敛。我们需要真正的heterogeneity
2. **模型多样性 ≠ prompt多样性**：不同prompt给同一模型不够，需要不同模型才能真正preserving disagreement
3. **Quality weighting的副作用**：在我们的系统中如果有"评估谁的回答更好"的机制，要警惕它可能压制有价值的少数意见
4. **小模型局限**：8B模型无法做nuanced deliberation——这决定了我们routing小模型时不应让它们做需要微妙权衡的决策
5. **Trustworthy tension rate**作为诊断指标：衡量小模型deliberation能力的新metric

## 标签
`multi-agent` `disagreement` `heterogeneity` `deliberation` `consensus-bias` `model-diversity`
