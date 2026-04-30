# ESamp: LLMs Explore by Latent Distilling

**Source**: arXiv 2604.24927 | ShanghaiTech | 2026-04-30
**Repo**: https://github.com/LinesHogan/tllm
**Tags**: #test-time-compute #diversity #sampling #inference

## 核心问题

当我们在test-time采样多个LLM响应时，我们真的得到了语义多样的推理路径，还是只是同一想法的表面变体？

## 方法：Exploratory Sampling (ESamp)

1. **Latent Distiller**: 轻量网络，在线训练预测LLM深层表示（从浅层表示）
2. **Novelty Signal**: 预测误差 = 新颖度。熟悉的语义轨迹容易预测，未探索方向误差高
3. **Guided Sampling**: 用novelty信号引导采样走向less-redundant continuations
4. **公式**: KL-regularized policy optimization; `logit_new = (1 + β) logit_ref − β logit_dist`

## 关键结果

- 数学、科学、代码、创意写作：多样性↑ + Pass@k效率↑
- **98.8% vLLM baseline throughput** — 异步实现，几乎零开销
- tLLM框架：vLLM的轻量模块加载器，提供对residual stream的low-overhead访问

## 对我们的意义

**Diversity-aware sampling是propose-verify loop的天然增强**。我们的系统在生成假设/方案时，表面多样性不等于语义多样性。ESamp的思路可以应用于：
- Agent生成多个plan时避免语义重复
- Research hypothesis generation时真正探索不同方向
- 用prediction error作为"是否真的在探索新东西"的信号

**tLLM作为inference intervention的通用框架**值得关注——它把test-time算法从inference引擎fork中解耦出来。
