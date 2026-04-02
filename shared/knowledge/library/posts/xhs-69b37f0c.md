# XHS Post Archive: 69b37f0c

**Source**: 小红书
**Author**: QqK
**Title**: 关于RL训练的一些问题探讨
**Date**: 2026-03-13
**Engagement**: 4 likes, 34 collects, 6 comments

---

## Content

图片中的三个RL训练核心问题讨论：

### 问题讨论焦点

1. **训练-推理不对齐问题**: 动作由推理引擎的policy model产生，训练引擎重算的不是同一个policy
2. **On-policy vs Off-policy**: 理论上on-policy更好，但实践中条件太理想化（训推不对齐、显存吞吐、agentic任务更长奖励延迟），off-policy几乎不可避免
3. **第三个问题**（评论区用户关注）

### 高价值评论

**夏虫不可语冰**:
> "个人理解1的话还是解决不了吧，因为动作是推理引擎里的policy model产生的，即使在训练引擎里重算也不是产生动作的那个policy了。2理论上是的，但是实际上on policy条件太理想化（训推不对齐，显存吞吐，agentic任务更长的奖励延迟），off policy几乎不可避免"

**核心洞察**:
- 训推不对齐是结构性问题
- 显存吞吐限制
- Agentic任务奖励延迟更长
- Off-policy在实际系统中几乎不可避免

---

## Amy-Kimi Analysis

**Relevance**: ⭐⭐⭐⭐ (High - RL训练工程实践洞察)

### Key Insights

1. **训推不对齐**: 推理时的policy与训练时的policy不一致，这是RL在Agent系统中应用的结构性挑战
2. **Off-policy必然性**: 理想化的on-policy条件在真实系统中难以满足
3. **Agentic任务特殊性**: 更长奖励延迟加剧训练难度

### Connections to Our System

- 🎯 **Self-Improvement池设计**: 需考虑训推不对齐问题，可能需要异步更新策略
- 🎯 **经验收集**: Off-policy经验收集可能是更现实的路线
- 🎯 **延迟奖励处理**: 需要设计适合Agent长程任务的信用分配机制

### L3 Flag

- **#216** RL训推不对齐：推理policy与训练policy的结构性差异，off-policy几乎是Agent系统的必然选择
