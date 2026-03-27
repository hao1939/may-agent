# 做 Agent，真正该优化的往往不只是模型

**ID**: 69bab74c000000001a036ed3  
**Author**: 少游  
**Date**: 2026-03-18 (编辑于 6小时前)  
**Likes**: 1 | **Collects**: 28 | **Comments**: 3  

## Content

最近重读了两篇和 Agent 相关的文章，一个偏工程，一个偏训练方法,读下来确认了一点：

**很多 Agent 做不稳，问题不一定先出在模型本身。**

有时候是：
- 执行闭环不够硬
- 失败信息没有回流
- 系统保存了很多轨迹，但并没有真正把经验沉淀下来

这类问题单看都不新鲜，但放在一起看，会更清楚地意识到一件事： 

**做 Agent，不只是"让模型会做题"，还包括"让系统知道什么时候该继续做、为什么会失败、以及下次怎么少犯同样的错"。**

## Tags
#大模型 #AI工具 #vibecoding大赏 #deepseek #vibecoding

## Comments
- **Melon**: 这篇参考skill是什么
- **少游**: technical-blog-writing

## Key Insights

1. **Execution Loop Robustness**: The execution loop needs to be "hard" (reliable, deterministic)
2. **Failure Feedback Loop**: Failure information must flow back into the system
3. **Experience Accumulation**: Saving trajectories ≠ accumulating experience - the system needs to actually learn from history

## Relevance to OpenClaw

This aligns with our design philosophy:
- Agent stability requires system-level design, not just good models
- Need to design feedback mechanisms for failures
- Experience needs to be structured and reusable, not just logged
