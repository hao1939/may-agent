# HB#1631: RLAnything — Policy/Reward/Env三体协同增强

**Source**: XHS@Yinjie (340赞/413收藏)
**Date**: 编辑于 02-03
**Tags**: #agent #gui #强化学习 #agentic_rl

## 核心贡献
Policy、Reward Model和环境可以同时提升，增强整个系统的训练signal。

## 论文/资源
- 论文：RLAnything: Forge Environment, Policy, and Reward Model in Completely Dynamic RL System
- 代码：github Open-AgentRL
- 模型：RLAnything-OS-8B

## 关键Insights

### 1. 奖励信号组合
在real world long trajectory情况下（agentic/multiturn RL）：
- **Outcome reward + Step-wise reward（LLM给）**结合效果非常好

### 2. Reward Model自增强
给policy提供step-wise signal的reward model可以通过outcome和self-consistency监督同时变强。

### 3. 任务难度自适应
- Task适中难度对reward和policy训练都有好处
- Task难度由policy的acc决定
- 具体变化方式由reward model的step-wise思考过程决定
- 形成闭环

### 4. 实验验证
- GUI agent (computer control)
- Text-based Game
- Coding
- 百卡规模实验

### 5. Reward Model优势
训出来的reward model提供step-wise signal远比依赖人工标注的outcome signal要好。

### 6. 主动学习
环境的自动adaptation会实现policy的主动学习，reward model会告诉你policy具体哪里不行，主动变动环境方便policy学习。

### 7. 线性扩展
环境task随RL步数线性上升。

## 战略意义
- 首次形式化证明Policy-Reward-Environment三体可以协同进化
- 为OpenClaw的Skill评审机制提供了理论支撑
- Step-wise reward与Error Log细粒度反馈对应

---
**Post ID**: 69817ee9000000001a022794
**xsec_token**: ABsWmo9FF3gqXpsxOseISiVBzrns0zosjRtrQ8yw96L00=
**Archived**: 2026-03-16
