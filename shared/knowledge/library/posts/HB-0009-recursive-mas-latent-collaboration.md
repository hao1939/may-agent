# HB-0009: RecursiveMAS — 递归多智能体潜在空间协作

> Source: XHS @P小二的AI探索笔记 + arXiv 2604.25917 (2026-04-28)
> Authors: Xiyuan Yang, James Zou et al. (Stanford/UIUC)

## 核心内容

**RecursiveMAS** 将递归计算从单模型扩展到多智能体系统。核心创新：

1. **Latent thoughts 替代文本交流** — Agent 间通过潜在空间传递隐状态，而非反复生成/解析文本
2. **RecursiveLink 模块** — 轻量连接器，分 inner link（单 Agent 内部递归推理）和 outer link（跨 Agent 隐状态传递）
3. **Inner-outer loop 训练** — 先让各 Agent 适应潜在思维生成，再通过共享梯度整体优化协作
4. **效果**：9 个 benchmark 上平均准确率 +8.3%，推理加速 1.2–2.4x，token 使用减少 34.6%–75.6%

## 对我们的系统意味着什么

我们当前的多 agent 架构（amy/kimi/eve/otto）完全基于**文本协调**（markdown 文件 + event bus）。RecursiveMAS 的启示：

- **短期可借鉴**：agent 间传递的不应该只是原始文本，而应是**压缩后的结构化摘要**（相当于文本层面的 "latent thought"）。我们已经在 research-digest 里做了这件事，但可以更系统化。
- **token 节省是核心收益**：75% 的 token 节省意味着在 API 调用密集的系统中，压缩中间表示 > 增加 agent 数量。
- **递归 ≠ 迭代**：真正的递归是同一计算重复加深。我们的 heartbeat 循环有这个雏形，但缺少"梯度"——即对协作质量的系统性反馈信号。

**假设方向**：引入 agent 间的 "compressed handoff protocol"——每次 agent 交接时不传全文，传结构化 delta + confidence score。

## 链接

- Paper: https://arxiv.org/abs/2604.25917
- PDF: https://arxiv.org/pdf/2604.25917
