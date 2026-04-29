# HB-0430: RecursiveMAS — 递归多智能体潜在空间协作

**来源**: 小红书 @P小二的AI探索笔记 (24赞/40收藏)
**日期**: 2025-04-30
**论文**: Recursive Multi-Agent Systems

## 核心思路

多个异构 Agent 不再通过文本反复交流，而是在**潜在空间**中传递 "latent thoughts"，通过 RecursiveLink 模块连接成循环。

### 架构

- **Inner Link**: 单个 Agent 内部的潜在推理循环
- **Outer Link**: 不同 Agent 之间的隐状态传递

### 训练方法 (Inner-Outer Loop)

1. 先让各 Agent 适应潜在思维生成
2. 再整体优化跨 Agent 协作

### 实验结果

- 9 个 benchmark（数学、科学、医学、搜索、代码生成）
- 平均准确率 +8.3%
- 推理加速 1.2–2.4x
- Token 使用减少 34.6%–75.6%

## 对我们系统的意义

我们的多 agent 系统（amy, git, max 等）完全依赖文本通信。这篇论文指向一个未来方向：

1. **Token 效率问题是真实的** — 我们的 agent 间通信全靠 markdown 文件和事件文本，成本高
2. **当前阶段不适用** — RecursiveMAS 需要模型微调，我们用的是 API 调用，无法操作 latent space
3. **但结构化压缩通信是可行的** — 即使在文本层面，也可以用更紧凑的协议代替冗长描述
