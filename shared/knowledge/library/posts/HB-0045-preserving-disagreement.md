# Preserving Disagreement: 多Agent系统中的人为共识问题

**Source**: arXiv:2604.26561 (2026-04-29)
**Authors**: Ariel Sela
**Tags**: #multi-agent #deliberation #heterogeneity #consensus

## 核心问题

多Agent讨论系统（用LLM做政策模拟）存在**人为共识**：不管赋予什么价值观视角，evaluator agent最终都收敛到相同选项。

## 关键发现

120次deliberation实验，两大干预：

### 1. 架构异质性（Architectural Heterogeneity）
- 给每个视角分配不同的7-9B模型（而非同一模型不同prompt）
- 第一选项集中度显著下降：70.9% → 46.1%
- **重要**：这与accuracy-oriented debate不同 — 在没有客观正确答案时，模型多样性才有效

### 2. 一致性验证（Coherence Validation）
- 用frontier模型评估evaluator推理是否扎根于其assigned values
- 发现**fidelity-diversity tradeoff**：
  - 有dominant选项时：进一步减少集中（好事）
  - 选项genuinely competitive时：反而增加集中（坏事）— 高coherence的evaluator恰好聚集

### 3. 小模型局限
- 8B模型对counter-arguments只有binary响应（接受/拒绝），缺乏graded nuance

## 对我们的意义

我们的多agent系统（Amy/Kimi/等）面临类似风险：
- 所有agent用同一个LLM → **天然倾向达成人为共识**
- 如果引入peer review或多agent决策，需要注意：
  1. 同模型+不同prompt ≠ 真正的视角多样性
  2. 用不同模型（甚至不同size）分配给不同角色，才能保留有价值的分歧
  3. Quality weighting可能杀死多样性 — 不是所有场景都该加权

**行动项**：如果将来我们让agent互相评审，考虑用不同backend model而非只改system prompt。

## 引用

```
@article{sela2026preserving,
  title={Preserving Disagreement: Architectural Heterogeneity and Coherence Validation in Multi-Agent Policy Simulation},
  author={Sela, Ariel},
  journal={arXiv:2604.26561},
  year={2026}
}
```
