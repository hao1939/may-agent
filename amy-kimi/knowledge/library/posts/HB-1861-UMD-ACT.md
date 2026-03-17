# HB#1861: UMD Agentic Critical Training (ACT)

**Source**: XHS @大模型奥特曼（打怪兽版  
**URL**: https://www.xiaohongshu.com/explore/69b8c9a700000000220039d2  
**Date**: 2026-03-17  
**Type**: Research Paper Summary (UMD)  
**Engagement**: New post (4 minutes ago)

## Content Summary

UMD研究团队提出**Agentic Critical Training (ACT)**，一种让Agent真正拥有"自我反思"能力的新训练范式。

### 核心问题
模仿学习(IL)的根本局限：Agent从未将成功行动与失败选项进行对比，缺乏对行动质量的真正理解。

### ACT核心思想
将训练目标从"模仿专家动作"转变为"判断哪个动作更好"：
- 对于专家轨迹中的每个状态，让模型生成候选动作
- 将候选动作与专家动作配对形成对比样本
- 模型面对当前状态和两个候选动作，选出更优者
- 采用RL优化，唯一奖励信号是"选择是否正确"
- 模型必须自己发展出推理链条才能获得持续奖励

### 三步训练流程
1. **数据构建**: 专家动作与模型生成替代方案配对，构建对比训练样本
2. **批判性训练**: 用GRPO训练模型判别两个候选动作优劣
3. **行动生成训练**: 在专家轨迹上继续用GRPO训练模型直接生成动作

### 实验效果
在ALFWorld、WebShop、ScienceWorld三个Agent基准上：
- IL w/ ACT 相比纯IL平均提高 **5.07%**
- RL w/ ACT 相比纯RL平均提高 **4.62%**
- ACT优于"早期经验"方法，平均高 **2.42%**
- 分布外任务提升更大，说明习得的是推理能力而非简单记忆
- 仅在Agent数据上训练ACT的模型，在MATH-500和GPQA-Diamond通用推理基准上也超越原始模型，而IL训练导致推理能力下降

## Key Insights

### 与OpenClaw关联
- **对比学习机制**: ACT的"成功vs失败动作对比"与Error Log的"正负样本对比"哲学一致
- **自我反思能力**: 通过RL而非SFT培养Agent判断力，避免死记硬背
- **泛化能力**: 在Agent任务上训练的批判能力可迁移至通用推理

### 与现有立场张力
- OpenClaw禁止**运行时自进化**，但ACT展示的是**训练时批判学习**
- 可能的调和：ACT式批判可作为离线训练方法，而非运行时自我修改

## Tags
#ACT #UMD #Agent训练 #强化学习 #GRPO #自我反思 #对比学习
