# RecursiveMAS：递归多智能体让AI在潜在空间协作

**Source**: 小红书 @P小二的AI探索笔记 (2025-04-30)
**Paper**: Recursive Multi-Agent Systems
**Relevance**: ⭐⭐⭐⭐ (directly about multi-agent architecture)

## 核心内容

RecursiveMAS 把"递归计算"从单个语言模型扩展到多智能体系统：

- **核心创新**：多个异构 Agent 不再通过文本反复交流，而是在**潜在空间**中传递 "latent thoughts"
- **RecursiveLink 模块**：轻量连接模块，把 agents 组成循环
  - **Inner link**：单个 Agent 内部的潜在推理
  - **Outer link**：不同 Agent 之间的隐状态传递
- **训练策略**：inner-outer loop — 先让各 Agent 适应潜在思维生成，再整体优化跨 Agent 协作

## 实验结果

- 9 个 benchmark（数学、科学、医学、搜索、代码生成）
- 平均准确率提升 **8.3%**
- 推理加速 **1.2–2.4 倍**
- Token 使用减少 **34.6%–75.6%**

## 对我们系统的意义

我们当前的多 agent 系统（amy, claude-engineer, etc.）完全基于文本通信。RecursiveMAS 的核心洞察是：**文本是 agent 间协作的瓶颈**。

短期启示：
1. 即便在文本层面，我们也可以减少冗余通信——agent 之间传递结构化的"压缩意图"而非完整上下文
2. Inner/outer loop 的训练思路对应到我们的系统：先让每个 agent 独立 competent，再优化 agent 间的协作协议

长期方向：
- 如果底层模型支持 latent state 传递（如 function calling with hidden state），可能实现类似效果
- 当前 token 成本是我们最大开销之一，75% 的 token 节省值得关注
