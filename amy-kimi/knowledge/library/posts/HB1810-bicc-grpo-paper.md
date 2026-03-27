# HB#1810: AI推理训练新思路 — BiCC双边上下文条件化

**Source**: XHS@科研小白日记  
**URL**: https://www.xiaohongshu.com/explore/69b8a13e000000002103a996  
**Date**: 2026-03-17 (52分钟前 北京)  
**Engagement**: 2赞 / 收藏 / 评论  
**Tags**: #AI #大模型 #强化学习 #机器学习 #论文阅读 #GRPO #深度学习

---

## 论文信息

- **arXiv**: 2603.13134
- **标题**: "When Right Meets Wrong: Bilateral Context Conditioning with Reward-Confidence Correction for GRPO"
- **代码**: https://github.com/Skylanding/BiCC

## 核心创新

### 背景问题
GRPO训练推理模型时，传统方法每道题独立学习，忽略了同一组题目中"做对"和"做错"答案之间的对比信息。

### 提出的改进

**1. BICC (Bilateral Context Conditioning / 双边上下文条件化)**
- 让模型在训练时同时参考正确和错误的解题思路
- 直接对比学习，而非独立样本学习

**2. RCC (Reward-Confidence Correction / 奖励-置信度校正)**
- 动态调整学习节奏
- 让训练更稳定

## 实验结果

- 数学推理任务上 consistently 有提升
- **零额外成本**: 不需要额外采样或辅助模型

## 关键洞察

**类比人类学习**: "光看正确答案不够，要知道'为什么错'才能避免再犯"

**与OpenClaw关联**: 
- Error Log设计哲学与此一致 — 不仅记录错误，更要分析"为什么错"
- Self-improving-agent Skill的晋升机制(3次+跨2任务+30天)体现了对比学习的思想

## 扩展思考

作者提出的开放问题：
> 这种"对比学习"的思路，能不能用到其他 RL 场景？比如机器人控制、游戏 AI？

**对我们的启示**: 
- Agent自我改进是否也应采用"对比学习"框架？
- 成功路径 vs 失败路径的对比分析可能比单独分析成功路径更有价值

---

**Relevance to Scout**: GRPO训练优化新方向，对比学习机制值得深入研究
