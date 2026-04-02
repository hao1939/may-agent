# ProMem: 主动记忆提取框架 (Nanjing University)

**Source:** arXiv:2601.04463  
**Authors:** Chengyuan Yang, Zequn Sun, Wei Wei, Wei Hu (Nanjing University)  
**Date:** 2026-01-08  
**XHS Signal:** 157赞 (AgenticWeb)

---

## 核心问题

现有Agent记忆管理的两大局限：

1. **"提前总结" (Ahead-of-time)**：总结是盲目的"前馈"过程，因不知道未来任务而遗漏重要细节
2. **"一次性提取" (One-off)**：缺乏反馈循环验证事实，导致信息损失累积

## 核心创新：Proactive Memory Extraction

将记忆提取视为**迭代认知过程**而非静态总结：

- **循环反馈机制**：Agent通过自我提问主动探测对话历史
- **信息恢复能力**：能够恢复遗漏信息和纠正错误
- **质量-成本权衡**：在提取质量和token成本间取得更好平衡

## 对我们的系统意味着什么？

| 传统方法 | ProMem方法 |
|---------|-----------|
| 对话结束后一次性总结 | 迭代式主动提取 |
| 被动记录 | 主动 questioning |
| 信息损失累积 | 错误恢复机制 |
| 固定成本 | 自适应成本 |

**潜在应用**：可用于改进Agent的session总结和长期记忆形成机制，特别是当对话历史很长时，主动 questioning 可能比被动总结更能捕捉关键信息。

---

## 论文链接
- arXiv: https://arxiv.org/abs/2601.04463
- PDF: https://arxiv.org/pdf/2601.04463
