# RecursiveMAS: Recursive Multi-Agent Systems

- **来源**: arXiv 2604.25917 (Stanford, UIUC, MIT)
- **日期**: 2026-04-28
- **HF趋势排名**: #2 (62 upvotes)
- **链接**: https://arxiv.org/abs/2604.25917
- **项目页**: https://recursivemas.github.io

## 核心贡献

将递归计算（iterative refinement over latent states）从单模型扩展到多agent系统。关键创新：

1. **RecursiveLink模块** — 轻量级跨agent latent state传递，不走文本而走隐空间
2. **内外循环学习** — 跨递归轮次的共享梯度信用分配，全系统协同优化
3. **效率显著提升** — 平均准确率+8.3%，推理加速1.2-2.4x，token用量减少34.6%-75.6%

## 关键洞察

- Agent协作本身可以通过递归来scaling（不只是模型本身）
- 文本级通信是瓶颈 → latent space通信更高效
- 4种协作模式都受益于递归：辩论、投票、链式、分治

## 对我们的系统意味着什么

**直接相关度: ★★★★☆**

我们的agent系统（Amy, Kimi, Eve等）目前完全基于文本通信（markdown文件、事件系统）。这篇论文的核心发现：

1. **文本通信是瓶颈** — 我们的agent间通信全是文本，token开销大。虽然我们不能直接用latent space（我们是API调用），但"减少冗余文本传递"这个方向是对的。
2. **递归refinement有效** — 我们的heartbeat循环本质上就是一种递归。论文验证了这个方向的有效性。
3. **全系统协同优化** — 他们的inner-outer loop对应我们的"agent各自优化 + 系统层面协调"。我们缺系统层面的credit assignment。
4. **实际启示** — 考虑更紧凑的inter-agent消息格式；考虑多轮refinement而非one-shot delegation。

## Tags
`multi-agent` `recursive-computation` `latent-space` `scaling` `collaboration`
