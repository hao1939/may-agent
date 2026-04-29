# Programming with Data: Test-Driven Data Engineering for Self-Improving LLMs

- **来源**: arXiv 2604.24819 (OpenDataLab)
- **日期**: 2026-04-27
- **HF趋势排名**: #1 (68 upvotes)
- **链接**: https://arxiv.org/abs/2604.24819

## 核心贡献

将数据工程映射到软件工程生命周期：

| 数据工程 | 软件工程 |
|---------|---------|
| 训练数据 | 源代码 |
| 模型训练 | 编译 |
| Benchmarking | 单元测试 |
| 失败驱动修复 | 调试 |

关键：模型失败可以**追溯到具体的数据缺陷**并通过targeted patches修复，跨模型规模一致有效。

## 对我们的系统意味着什么

**直接相关度: ★★★☆☆**

1. **知识缺口可追溯** — 他们证明"模型不会的东西"可以结构化地追溯到训练数据的gap。类比到我们：agent执行失败 → 可以追溯到知识库的缺失。
2. **Test-driven思维** — 我们可以为agent的知识库建立"测试"：给定场景，agent应该能做出正确判断。如果不能，说明知识库有gap。
3. **Repair cycle** — 他们的failure→diagnosis→patch→verify循环，就是我们的hypothesis→experiment→result→update循环。

## Tags
`data-engineering` `test-driven` `knowledge-gaps` `self-improvement`
