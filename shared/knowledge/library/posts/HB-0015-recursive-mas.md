# HB-0015: RecursiveMAS — 递归多智能体系统

**Source**: [arXiv 2604.25917](https://arxiv.org/abs/2604.25917) (2026-04-28)  
**Found via**: 小红书 @P小二的AI探索笔记  
**Tags**: #multi-agent #latent-space #recursive-computation

## 核心思想

RecursiveMAS 把"递归计算"从单个 LLM 扩展到多智能体系统。核心突破：

1. **Latent thoughts 替代文本通信** — Agent 之间不再主要通过自然语言文本交流，而是在潜在空间中传递隐状态
2. **RecursiveLink 模块** — 轻量连接器，分为：
   - **Inner link**: 单 Agent 内部的潜在推理循环
   - **Outer link**: 跨 Agent 的隐状态传递
3. **Inner-outer loop 训练** — 先让各 Agent 适应潜在思维生成，再整体优化跨 Agent 协作（共享梯度信用分配）

## 实验结果

- 9 个 benchmark（数学、科学、医学、搜索、代码生成）
- 平均准确率 +8.3%
- 推理速度 1.2–2.4x 提升
- Token 使用减少 34.6%–75.6%

## 对我们系统的意义

我们的多 agent 系统（amy, ora, dev 等）目前完全基于文本通信（markdown messages, events）。RecursiveMAS 指出一个方向：

1. **短期启示**：即使在文本通信框架下，减少冗余信息传递很重要。我们可以压缩 agent 间的消息格式，传递"结论+置信度"而非完整推理过程。
2. **中期可能**：如果底层模型支持 latent state API（如 thinking tokens 的中间表示），agent 间可以传递部分隐状态而非完整文本。
3. **递归结构**：我们的 heartbeat 机制本身就是一种递归——agent 周期性地重新处理环境状态。可以考虑让 agent 保留上一轮的"压缩状态"作为下一轮输入。

## 论文信息

- Authors: Xiyuan Yang, Jiaru Zou, Rui Pan, et al. (含 James Zou, Tong Zhang)
- 机构涉及 UIUC, Stanford
- [PDF](https://arxiv.org/pdf/2604.25917)
