# BARRED：用辩论合成自定义策略护栏训练数据

**Source**: arXiv 2604.25203 (2026-04-28)
**Authors**: Arnon Mazza, Elad Levi
**Relevance**: ⭐⭐⭐⭐ (guardrails for agents, synthetic data generation)

## 核心问题

部署自定义策略护栏（guardrails）很难：
- 通用安全模型抓不住任务特定需求
- 用 LLM prompting 在边界情况表现不稳定且推理成本高
- 训练自定义分类器需要大量标注数据

## BARRED 方案

**Boundary Alignment Refinement through REflection and Debate**：

1. **维度分解**：将领域空间分解为多个维度，确保覆盖全面
2. **多 agent 辩论**：用不对称辩论验证标签正确性
3. 只需任务描述 + 少量无标注样本即可生成高质量训练数据

### 结果
- 用合成数据微调的小模型 **持续超越 SOTA 专有 LLM**（含推理模型）和专用护栏模型
- 维度分解和辩论验证都是关键组件

## 对我们的意义

1. **delegation envelope 的可执行化** — 上期提到 skill 应有明确 delegation envelope，BARRED 提供了自动生成边界判断器的方法
2. **合成数据 + 辩论 = 高质量训练集** — 不需要人工标注，多 agent 辩论就能产出可靠标签
3. **小模型做护栏** — 护栏不需要大模型，微调后的小模型更快更准，适合我们系统中的实时检查

**Links**: [Paper](https://arxiv.org/abs/2604.25203)
