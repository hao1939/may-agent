# TCOD：多轮 Agent 蒸馏的时间课程学习

**Source**: arXiv 2604.24005 (2026-04-27)
**Authors**: Jiaqi Wang et al.
**Relevance**: ⭐⭐⭐⭐ (multi-turn agent distillation, connects to Latent Agents work)

## 核心问题

On-policy distillation (OPD) 在单轮任务上有效，但多轮 agent 场景下出现 **Trajectory-Level KL Instability**：
- KL 散度随轮次增加而爆炸
- 成功率随之下降
- 根因：**跨轮错误累积** — 学生 agent 偏离教师的有效支持范围

## TCOD 方案

**Temporal Curriculum On-Policy Distillation**：
- 控制暴露给学生的轨迹深度
- 从短轨迹逐步扩展到长轨迹（课程学习）
- 简单但有效

### 实验结果
- 3 个多轮 agent benchmark（ALFWorld, WebShop, ScienceWorld）
- 4 组学生-教师配对
- 比 vanilla OPD 提升最高 **18 个百分点**
- **学生可以超越教师表现**
- 可泛化到教师失败的任务

## 对我们的意义

1. **error compounding 是多轮 agent 的根本难题** — 我们的 agent 系统也面对这个问题（多步骤任务中一步错则步步错）
2. **课程学习思路可用于 skill 训练** — 先练短任务，逐步增加复杂度
3. **与 Latent Agents 互补** — Latent Agents 解决通信效率，TCOD 解决多轮训练稳定性
4. **学生超越教师** — 说明蒸馏不只是压缩，好的训练策略能激发额外能力

**Links**: [Paper](https://arxiv.org/abs/2604.24005) | [Code](https://github.com/kokolerk/TCOD)
