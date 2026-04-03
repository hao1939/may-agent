# Self-Evolving Agents综述: 从模型中心到环境驱动

**来源**: 小红书 @AI PaperDaily  
**论文标题**: 《A Systematic Survey of Self-Evolving Agents: From Model-Centric to Environment-Driven Co-Evolution》  
**时间**: 2025-03-02  
**标签**: #SelfEvolving #Agent #综述 #环境驱动 #协同进化

---

## 核心观点

### 范式演进路径

```
模型中心进化 → 数据/经验驱动进化 → 环境驱动协同进化
```

**关键转变**: 跳出传统"以模型为中心"的思路，聚焦**智能体与环境双向迭代、动态共生**

---

## 技术路径梳理

| 阶段 | 特征 | 代表方向 |
|------|------|---------|
| 模型中心进化 | 模型参数更新、微调 | SFT, RLHF |
| 数据/经验驱动 | 从交互中学习、积累经验 | Experience Replay, World Models |
| 环境驱动协同 | 环境-智能体共同演化 | Co-evolution, Multi-agent Ecology |

---

## 核心议题

1. **协同进化机制** (Co-evolution Mechanisms)  
   智能体与环境如何相互塑造

2. **多智能体生态自适应** (Multi-agent Ecology Adaptation)  
   多个智能体如何在共享环境中共存协作

3. **开放世界鲁棒性** (Open-world Robustness)  
   应对未见过的新环境、新任务

4. **安全对齐** (Safety Alignment)  
   进化过程中的安全约束和价值对齐

---

## 社区讨论精华

> "静态模型再大也有知识截断的问题，而自进化框架通过环境交互的闭环反馈实现持续学习" — @Amazing Grace

> "期待看到这个方向在长期记忆管理和catastrophic forgetting方面的解决方案" — @Amazing Grace

---

## 对我们的意义

### 战略层面

1. **方向确认**: Self-evolving是我们系统的正确方向，与业界前沿一致
2. **技术储备**: 需要关注环境驱动协同进化的具体实现机制
3. **挑战预警**: catastrophic forgetting是公认难题，我们需要提前设计应对

### 技术层面

1. **记忆系统**: 与Agent Memory新范式高度相关，需要分层设计
2. **环境设计**: 我们的"环境"是什么？（代码仓库？任务队列？）
3. **评估体系**: 如何评估进化效果？需要建立反馈闭环

### 假设方向

- H-XXX: 环境驱动的Skill进化机制
- H-XXX: 多Agent协作中的生态位分化
- H-XXX: 长期记忆与持续学习框架

---

## 延伸阅读

- 查找论文原文（TechRxiv，因arXiv限制综述投稿）
- 关联阅读: Tool Verification for Test-Time Reinforcement Learning（评论区推荐）
