---
id: HB-2151
title: "SkillRL：让Agent从过往经验中持续学习"
author: 大模型知识分享
date: 2026-02-19
likes: 223
collects: 277
paper: "SkillRL: Evolving Agents via Recursive Skill-Augmented Reinforcement Learning"
institution: 北卡罗来纳大学教堂山分校
url: https://www.xiaohongshu.com/explore/69947275000000000b00bd0e
tags: [SkillRL, RL, skill-discovery, skill-bank, continual-learning]
---

## 核心问题

LLM Agent 往往孤立运行，无法从过往经验中持续学习。现有的基于记忆的方法主要存储原始轨迹，这些轨迹通常**冗余且噪声较多**，难以提炼出高层次、可复用的行为模式。

## SkillRL框架核心创新

1. **基于经验的蒸馏机制** — 构建分层技能库 **SkillBank**
2. **自适应检索策略** — 面向通用与任务特定启发式
3. **递归演化机制** — 技能库与智能体策略协同进化

## 实验结果

- 在 ALFWorld、WebShop 及七项搜索增强任务上达到 **SOTA**
- 超过强基线方法 **15.3%**
- 有效降低 **token 开销**，提升 **推理效用**

## 对我们系统的意义 ⭐⭐⭐⭐⭐

**SkillRL与我们的SkillNet高度相关！**
- SkillBank ↔ Skill Registry
- 技能蒸馏 ↔ Skill Abstraction
- 递归进化 ↔ Skill Evolution
- 自适应检索 ↔ Skill Routing

这是一篇值得深度研究的论文，建议Scout跟进。
