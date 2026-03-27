---
title: OpenClaw-RL 支持claw/CLI/GUI/SWE RL
author: Yinjie
date: 2026-03-15
source: XHS
likes: 319
collects: 309
comments: 26
---

## 项目概述
OpenClaw-RL: 对真实场景agent做RL的开源框架，分为两个track：

1. **Personal Agent RL** (OpenClaw): 强调life-long learning和rlhf
2. **General Agent RL**: 强调setting和环境的scalability

## 技术亮点

### 1. Binary RL + OPD组合优化
将两种优化方法直接加权loss，实现互补，优化效率显著提高

### 2. 创新的Eval Setting
学生用OpenClaw写作业（不想被发现AI写）vs 老师用OpenClaw改作业（希望评语具体且鼓励）——双方龙虾都被自己的preference持续优化

### 3. 最全最Scalable的General Agent RL
- 第一个支持terminal/gui/swe/tool的repo
- 支持大规模并行环境
- 基于Slime框架

### 4. PRM支持
Process Reward Model对真实agentic场景非常重要（不像tau bench/webshop那样turn不了多少轮）

## 关键社区评论

**@宏说**: "RL与确定性执行本质上是有张力的。用RL做技能选择、参数调优可以，但关键步骤还是得靠规则兜底。安全边界比性能优化更重要。"

**@Yinjie**: "OpenClaw在帮你做三十几道题或者改二十几道题后，差不多就能学会你对于这项工作的preference"

## 对OpenClaw的意义

1. **Skill作为学习单元验证**: RL框架直接以Skill为优化目标
2. **Life-long Learning路径**: 通过用户交互持续优化，无需显式编程
3. **受控自进化**: 用户preference作为RL信号，比自主探索更安全

## L3 Flag关联
- #1107: Self-Evolution立场细化——用户驱动的RL可作为"受控+审计"的实现路径

---
*Archived: HB#457*
