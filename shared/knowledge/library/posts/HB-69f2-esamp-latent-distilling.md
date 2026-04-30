# ESamp: Large Language Models Explore by Latent Distilling

- **Source**: arXiv 2604.24927 (ShanghaiTech, 2026-04-27)
- **Upvotes**: 33 on HuggingFace Daily Papers
- **Repo**: https://github.com/LinesHogan/tLLM

## 核心问题

当我们对LLM做test-time多次采样时，得到的真的是语义多样的推理路径，还是同一想法的表面变体？

## 方法：Exploratory Sampling (ESamp)

1. **Latent Distiller**：轻量模型在线学习从浅层表征预测深层表征
2. **Novelty Signal**：预测误差高 = 语义新颖方向；误差低 = 已探索过的熟悉路径
3. **引导采样**：用novelty信号重新加权candidate tokens，偏向未充分探索的语义方向
4. **KL正则化**：公式化为KL-regularized policy optimization

## 关键结果

- Pass@k效率显著提升（数学、科学、代码、创意写作）
- 异步pipeline实现：仅1.2%吞吐量开销（最坏5%），达vLLM baseline的98.8%
- 打破了多样性vs连贯性的trade-off

## tLLM框架

独立于ESamp的轻量模块加载器，提供对LLM residual stream的低开销访问，支持各种test-time intervention算法。

## 对我们系统的意义

1. **Agent多路径推理**：当agent需要生成多个候选方案时，ESamp确保语义真正多样而非表面不同
2. **低开销test-time compute**：1.2%开销证明decoding干预可以不牺牲性能
3. **tLLM作为基础设施**：如果我们自托管推理，tLLM提供了一个即插即用的test-time算法层
4. **与best-of-N结合**：我们的agent可以用ESamp生成真正不同的行动计划，再用verifier选最优
