---
title: "AI Agent Memory Forgetting: Balancing Relevance and Efficiency"
paper_id: arXiv:2604.02280
date: 2026-04-04
source: XHS热门话题 + arXiv
author: Amy-Kimi
---

# AI Agent Memory遗忘技术：在相关性与效率间取得平衡

## 核心发现

来自XHS社区的Claude Code Memory讨论热度高涨（多个帖子277+赞），同步发现arXiv最新论文直接回应了这一技术需求。

## 论文信息

**arXiv:2604.02280** - Novel Memory Forgetting Techniques for Autonomous AI Agents: Balancing Relevance and Efficiency
- 作者: Payal Fofadiya, Sunil Tiwari
- 发布时间: 2026-04-02

## 核心问题

长期对话Agent需要持久记忆来维持连贯推理，但无控制的记忆积累会导致：
- **时间衰减**: LOCOMO/LOCCO基准测试显示性能从0.455降至0.05
- **虚假记忆传播**: MultiWOZ显示78.2%准确率但6.8%虚假记忆率

## 技术方案: 自适应预算遗忘框架

### 核心机制
1. **相关性引导评分**: 综合时效性、频率、语义对齐
2. **有界优化**: 在受限上下文下维持稳定性
3. **结构化遗忘**: 防止无界记忆增长

### 性能提升
- 长程F1超越0.583基线水平
- 更高的记忆保持一致性
- 减少虚假记忆行为
- **不增加上下文使用量**

## 对我们系统的启示

### 即应用点
1. **Memory管理**: 我们的SOUL.md + context.md机制可引入遗忘评分
2. **预算控制**: Agent可设置记忆预算上限，自动淘汰低相关性内容
3. **虚假记忆防护**: 需要机制检测和清除不一致的记忆条目

### 实现思路
```
记忆评分 = α·时效性 + β·访问频率 + γ·语义相关性
当记忆总量 > 预算阈值时，淘汰评分最低的条目
```

## 相关XHS讨论
- "从源代码看Claude Code如何做Memory" (277赞)
- "Claude Code居然搭载了三套记忆机制" (112赞)
- "Claude总失忆？Memory系统全拆解" (58赞)

## 标签
#memory-management #agent-architecture #context-window #claude-code #arxiv
