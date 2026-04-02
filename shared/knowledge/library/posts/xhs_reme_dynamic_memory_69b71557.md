# XHS: 强烈推荐读一下这篇动态过程记忆框架论文

**ID**: 69b71557000000001f006570
**Author**: 硅谷刘老师 (数据岗快速上岸）
**Likes**: 62 | **Collects**: 97
**Date**: 编辑于 1天前 美国
**URL**: https://www.xiaohongshu.com/explore/69b71557000000001f006570

---

## 论文信息
- **标题**: Remember Me, Refine Me: A Dynamic Procedural Memory Framework for Experience-Driven Agent Evolution
- **领域**: 过程记忆 (Procedural Memory) / Agent长期学习

## 核心问题
当前LLM智能体过程记忆（procedural memory，主要是"how-to"知识、工具使用经验）大多采用**被动积累模式**：
- 只是存原始轨迹（raw trajectories）
- 噪声多、冗余严重
- 过时经验不删除
- 检索出来的经验不适应新场景
- 最终效果"会存但不会忘、会取但不会用"

结果是智能体长期学习能力弱，容易重复犯错、陷入局部最优。

## ReMe框架创新
把记忆从"静态存储"升级为**动态演化认知基底**，核心是三个机制贯穿记忆全生命周期：

### 1. 多维度经验蒸馏 (multi-faceted experience distillation)
- 主动分析成功模式、失败触发点
- 生成对比洞见（comparative insights）
- 从嘈杂执行轨迹中提炼出高质量、可复用的过程知识，而不是存原始日志

### 2. 上下文自适应重用 (context-adaptive reuse)
- 场景感知索引（scenario-aware indexing）
- 根据当前任务上下文，动态裁剪、调整历史经验，让旧知识在新场景下"活起来"

### 3. 效用驱动精炼 (utility-based refinement)
- 自动加入有效记忆
- 自动剪枝过时/低质记忆
- 保持记忆池紧凑、高质量、活力持续

## 实验结论
- 在 BFCL-V3 和 AppWorld 两个前沿智能体基准上，ReMe 达到了新的 SOTA
- **最震撼的 scaling 效应**: Qwen3-8B + ReMe 打败了 无记忆的 Qwen3-14B
- 说明：好的记忆演化机制比单纯堆参数更有效，ReMe 提供了一种计算高效的终身学习路径

## 核心洞见
Agent 的记忆系统不能只会存，要会取、会忘、会改、会进化 — ReMe 把"被动积累"范式转向"经验驱动的主动演化"

## 与OpenClaw关联
- ReMe的"经验蒸馏"与OpenClaw的Skill进化机制概念相似
- 但OpenClaw采用"人工审计"而非自动演化，这与ReMe的自动精炼形成张力
- ReMe证明了记忆质量可以弥补模型规模差距（8B+ReMe > 14B无记忆），支持Context Engineering优先策略

---
**HB ID**: HB#1901-relevant
**Archive Date**: 2026-03-17
**Tags**: #memory #procedural-memory #ReMe #experience-distillation #context-adaptive #utility-refinement
