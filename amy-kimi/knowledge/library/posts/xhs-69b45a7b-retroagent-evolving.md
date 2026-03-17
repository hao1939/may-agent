# XHS#69b45a7b — 让 agent 从 solving 走向 evolving

**Source**: momo (小红书)  
**Date**: 2026-03-14 (2天前)  
**Engagement**: 125 likes, 210 collects, 6 comments  
**Paper**: RetroAgent: From Solving to Evolving via Retrospective Dual Intrinsic Feedback  
**Archive Date**: 2026-03-16

---

## TL;DR
RetroAgent解决的不是agent能否完成一次任务，而是能否随着经验持续变强。通过retrospective dual intrinsic feedback（数值型+语言型反馈结合），训练目标从单次success转向长期策略演化。

---

## 核心机制

### 双重内在反馈 (Dual Intrinsic Feedback)
1. **数值型反馈**: 鼓励阶段性进展，agent在中间步骤知道是否朝着更好方向前进
2. **语言型反馈**: 把可复用经验写成lesson，存入memory buffer

### Utility驱动的Lesson Retrieval
不是机械召回所有经验，而是在真正有帮助时才调出对应经验参与决策。

---

## 研究动机
**一次性解题器问题**: 只靠外部任务奖励训练，任务做完就结束，经验没有真正沉淀。

**持续学习目标**: agent不只要会做题，还要会：
- 回顾过程
- 提炼lesson
- 下次任务重新用

**现有方法缺陷**: 缺少把短期反馈和长期经验连接起来的机制。

---

## 实验结论
- Retrospective feedback设计在多个交互环境获得更稳定提升
- 收益不只体现在单次任务成功率
- 策略能随着经验继续演化

---

## 评论区亮点
**作者XyZ回复** (疑似论文作者):
- 代码开源：正在整理中，争取明天晚上放GitHub
- 关于运行时评价：通过RL-training方式训练优化模型self-reflection capability，model self-evaluation与oracle task success匹配来提供奖励信号

**社区反馈**:
- "agent运行时的结果在线评价挺难的" — 落秋

---

## OpenClaw张力分析

| RetroAgent概念 | OpenClaw立场 | 张力 |
|----------------|--------------|------|
| 持续演化 | 禁止运行时自进化 | 🔴 原则冲突 |
| 经验沉淀 | Error Log记录 | 🟡 部分对齐 |
| 语言型反思 | heartbeat机制 | 🟢 形式相似 |
| Utility检索 | Skill routing | 🟢 机制同构 |

**关键区别**: RetroAgent强调**运行时**经验积累和策略更新；OpenClaw强调**离线**Error Log审计和Skill更新。

---

## Insights
1. **Self-Evolution边界**: 论文验证"经验驱动改进"有价值，但OpenClaw的"禁止运行时自进化"关注的是**安全性**而非**效果**
2. **Error Log设计验证**: 语言型反思机制与我们的heartbeat反思+记录形式等价
3. **持续学习是方向**: 社区高收藏(210)表明"solving→evolving"是热点话题

**Relevance**: 🔥 中高 — 与OpenClaw Self-Evolution立场形成有价值的张力对话

**Relevant to**: scout (论文追踪)
