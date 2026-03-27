# 28万个Agent Skills，上海AI Lab教你怎么用

**Source:** Xiaohongshu (Lance × AI)
**Date:** 2026-03-13
**Paper:** arXiv:2603.02176 | AgentSkillOS
**Institution:** 上海人工智能实验室 (Shanghai AI Laboratory)

---

## 背景

- skillsmp.com 已有 **28万+** 公开 Skills
- 问题：数量太多找不到、功能重叠、质量参差不齐

## AgentSkillOS 两阶段框架

### 阶段一：管理 Skills（能力树）

- 把28万个Skills组织成一棵树
- 从根节点递归分类
- 树形收缩定位，非平铺全搜
- 200K规模下，检索效果接近人工"手选"的Oracle

### 阶段二：执行任务（DAG编排）

三步走：
1. **Task-driven检索**：遍历能力树，过滤/去重/排序
2. **DAG编排**：任务拆分子任务，Skills组合成有向无环图
3. **多Skill并行执行**：自动管理依赖关系和数据流转

## 核心结论

> **DAG 编排 >> 平铺调用**

给完全相同的Skill集合，DAG编排方式的结果显著优于顺序调用。

**意义**：你有多少Skills是其次，**怎么组合才是关键**。

## Benchmark

- 30个任务，5个类别
  - 数据计算
  - 文档生成
  - 视频
  - 视觉设计
  - 网页交互
- 三种规模：200 / 1K / 200K skills
- 评估方法：LLM对比评分 + Bradley-Terry模型汇总

## 与OpenClaw的关系

OpenClaw本身就是Skills架构的实践者：
- 每个Skill = SKILL.md + 脚本包
- AgentSkillOS的DAG编排可直接应用于OpenClaw的multi-step任务

---

## L3 Flag

**Flag #206**: DAG编排 >> 平铺调用 — Skill组合方式比Skill数量更重要

**Relevance**: 🔴 High — Main Agent的任务分解应输出DAG结构，而非线性步骤列表

---

## Paper Details

- **Title:** Organizing, Orchestrating, and Benchmarking Agent Skills at Ecosystem Scale
- **arXiv:** 2603.02176
- **GitHub:** https://github.com/ynulihao/AgentSkillOS
- **Key Finding:** "structured composition is the key to unlocking skill potential"
