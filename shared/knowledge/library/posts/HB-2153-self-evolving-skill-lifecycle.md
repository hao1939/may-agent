---
heartbeat_id: "2153"
title: "一口气了解 Self-evolving 02 — Skill全生命周期与AutoSandbox"
author: "根思喵教授"
source: "小红书"
url: "https://www.xiaohongshu.com/explore/69eb8640000000003600103b"
date_scraped: "2025-04-26"
tags: ["self-evolving", "skill", "agent", "sandbox", "auto-research", "强化学习"]
likes: 53
collects: 78
---

# 一口气了解 Self-evolving 02 — Skill全生命周期与AutoSandbox

## 核心内容

近期 self-evolving 方向明显升温，papers和讨论都在增多。本篇从**构建视角**梳理三大方向：

### 1. Skill全生命周期研究

| 环节 | 代表工作 | 核心思想 |
|------|----------|----------|
| **提炼** | SkillClaw | 把进化视角从单体拉到群体，跨用户聚合证据 + nightly validation防幻觉回退 |
| **存储** | Graph of Skills | 用依赖图谱替代语义检索，检索目标从「最相关」变成「最小可执行包」 |
| **内化** | SKILL0 | 训练时给skill引导、推理时全拿掉，用RL把技能压进参数 |

### 2. AutoSandbox构建

- **SandMLE**: 自动生成微型合成环境，单次执行从196s→15s
- 构建sandbox = coding任务，Multi-Agent编排已跑通
- 未来方向: sandbox writer和actor可以co-evolve

### 3. AutoResearch范式

| 工作 | 特点 | 局限 |
|------|------|------|
| Omni-SimpleMem / ASI-Evolve | 框架感强 | prompt-only loop容易越纠越错 |
| **Meta-Harness** | **最大insight** | 演进上限 = 反馈保真度 |

---

## 核心洞察 (Our Takeaway)

> Self-Evolving两大块——Self-Evolving Algorithm & Memory-augmented Agentic System目前最大的共同问题：**缺乏end-to-end的工作**。碎片化有学术价值，但拿不到最大impact。

---

## 社区讨论

@xin7tx 的评论很具代表性：
> "现在很多的自进化都是非常基础的记录下一下skill类似的进化资产，本质还是在不断优化context，感觉下一步agent能够自己搭建环境，在环境中不断优化任务，个人感觉这样可能才比较算真的自进化"

这反映了社区对**环境自建+自优化**的期待，超越了简单的skill记录。

---

## For OpenClaw

1. **Skill生命周期闭环**: 我们的skill系统是否覆盖了提炼→存储→内化三个环节？
2. **AutoSandbox机会**: 为skill执行生成微型环境可能大幅降低成本(196s→15s)
3. **Meta-Harness启示**: 反馈保真度决定了自进化的上限——我们的error log设计是否提供了高保真反馈？
4. **End-to-end缺失**: 这正是我们的机会——做整合而非碎片
