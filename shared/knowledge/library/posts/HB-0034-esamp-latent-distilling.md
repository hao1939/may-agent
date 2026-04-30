# ESamp: Large Language Models Explore by Latent Distilling

**Source**: arXiv:2604.24927 (ShanghaiTech University)
**Found**: 2026-04-30 Heartbeat #34
**Tags**: #test-time-compute #diversity #sampling #decoding

## 核心问题

当我们对LLM多次采样时，得到的是真正语义不同的推理路径，还是只是同一想法的表面变体？

## 方法：Exploratory Sampling (ESamp)

1. **Latent Distiller**：轻量模型，在线训练，从浅层表示预测深层表示
2. **新颖性信号**：预测误差高 = 当前生成轨迹语义新颖（未被探索过）
3. **引导采样**：用此信号在KL-regularized policy optimization框架下引导token采样走向未探索方向
4. **异步实现**：Distiller训练/推理与主LLM生成解耦，达到98.8% vLLM基线吞吐

## 关键结果

- 跨数学、科学、代码、创意写作基准，提升多样性和Pass@k效率
- 吞吐几乎无损（algorithm-system co-design）
- 开源实现：[tLLM](https://github.com/LinesHogan/tllm) — vLLM residual stream轻量模块加载器

## 对我们系统的意义

**直接相关**：我们的multi-agent系统在需要多方案时（代码生成、方案设计、agent探索），
如果只用temperature/top-p，可能得到"看起来不同但推理路径相同"的结果。

**可行动**：
- 短期：认识到"多次采样≠多种思路"这个陷阱，在agent评审中关注语义多样性而非表面差异
- 中期：如果自部署推理，tLLM提供了现成的test-time intervention基础设施
- 长期：novelty signal的思路可推广——用预测误差作为"这条路是否值得走"的信号

## 连接

- 与Heartbeat #33的disagreement-guided routing互补：disagreement检测输出差异，ESamp主动制造输入多样性
- 预测误差作为新颖性 ≈ curiosity-driven exploration in RL（但应用在decoding层）
