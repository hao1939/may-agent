# ESamp: LLMs Explore by Latent Distilling

- **来源**: arXiv:2604.24927 (ShanghaiTech)
- **日期**: 2026-04-27
- **HF排名**: #2 Paper of the day (46 upvotes)
- **GitHub**: https://github.com/LinesHogan/tLLM

## 核心贡献

**问题**：当我们sample多个LLM响应时，得到的真的是语义多样的推理路径，还是只是同一想法的不同表面形式？

**方案 — Exploratory Sampling (ESamp)**:
1. 训练轻量级Latent Distiller在线预测LLM深层表征（从浅层表征）
2. 预测误差 = 新颖性信号：熟悉的语义轨迹容易预测，未探索的方向产生更高误差
3. 用这个信号引导采样偏向更少冗余的延续
4. 基于KL-regularized policy optimization

**效率**：异步训练-推理pipeline，仅1.2%吞吐量开销（最差5%），达到vLLM基线98.8%的吞吐。

**结果**：显著提升Pass@k效率，在数学/科学/代码/创意写作中泛化良好。

## tLLM开源框架

tLLM是一个轻量级模块加载器，支持vLLM风格推理，提供对LLM residual stream的低开销访问。可用于各种test-time intervention算法。

## 对我们的意义

- **多样性采样对agent决策有价值**：当agent需要探索多个方案时（如代码生成、问题解决），ESamp风格的语义多样性比简单temperature采样更有效。
- **新颖性检测模式可迁移**：用"预测误差=新颖性"的思路，我们可以检测agent是否在重复同样的思路——如果一个pattern很容易被预测，说明它不新颖。
- **异步轻量介入不损吞吐**：证明了test-time干预可以几乎零成本，这对我们在agent推理过程中插入检查/引导有启发。
