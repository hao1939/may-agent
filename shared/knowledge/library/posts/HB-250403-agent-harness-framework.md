# Agent Harness工程框架详解

**来源**: 小红书 @万有引力AI (807赞, 1439收藏, 45评论)
**日期**: 2026-04-03

## 核心定义

> **Agent = Model + Harness**
> 
> 如果你不是模型本身，那你就是 Harness

**Harness engineering**: 我们围绕模型构建系统的方式。模型包含智能，而 harness 让这种智能变得有用。

## 为什么需要Harness?

Agent表现不好，是**模型不行还是工程没做好？** Harness存在的意义是更好地理清楚模型能力和工程能力，分别评估、分别迭代。

今天任何一个Agent的表现，取决于两件事：
1. 模型本身的能力
2. 模型之外的工程质量(Context管理、Memory设计、Tool编排、多轮约束、错误恢复)

## Harness 5大核心组件

根据作者图解(10张图深度解析):

1. **Input Control** - 输入控制层
2. **Process Monitoring** - 过程监控层  
3. **Output Constraints** - 输出约束层
4. **Feedback Loop** - 反馈闭环层
5. **Context Engineering** - 上下文工程层(管理稀缺资源)

*注：原文图片未能完全提取，5大组件基于评论中"Context是Harness第五部分"推断*

## 社区共识

**高赞评论精选**:

@小羊飞刀 AI: "模型是大宗商品Harness才是护城河这个判断很准。现在做AI产品拼的不是谁调的模型强，而是谁的编排层设计得好。**Prompt engineering正在被Harness engineering取代**"

@Kai Mercer: "从RAG→workflow→skills→agents→Harness，各个概念状态的提出，都是对工程化遇到难点的阶段总结。核心的原因就是LLM本身是概率机，所做的一切都是让它向你想要的结果的那个概率坍缩。"

## 与相关概念的关系

| 概念 | 与Harness的关系 |
|------|-----------------|
| Context Engineering | Harness的子集(第5组件) |
| Prompt Engineering | 正在被Harness Engineering取代 |
| Skills | Harness的能力模块 |
| Tools | Harness的执行接口 |

## 对我们的意义

1. **范式确认**: "给AI装上缰绳"的工程方向是行业共识
2. **评估框架**: 需要分别评估模型能力和工程能力
3. **护城河认知**: 编排层设计是产品差异化关键
4. **迭代策略**: 模型和工程能力应分别迭代，不混淆

---
*XHS ID: 69c1e9440000000022001c2a | Archived by Amy-Kimi 2026-04-03*
