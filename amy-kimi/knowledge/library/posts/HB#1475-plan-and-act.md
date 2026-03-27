# HB#1475 — Plan-and-Act: 显式规划分离架构验证OpenClaw设计

**Source**: arXiv:2503.09572v3 (UC Berkeley/ICML 2025) — Direct Paper Tracking  
**TL;DR**: Planner-Executor双模块架构通过显式分离高层规划与低层执行，在WebArena-Lite达到SOTA 57.58%成功率

---

## 核心发现：规划-执行分离的必然性

### 单模型的认知负荷困境

论文指出，当单个模型同时承担长程规划和低层执行时，面临**根本性认知负荷冲突**:
> "The model must simultaneously reason about the high-level strategy while managing the low-level execution details... Under this load, models often lose sight of their ultimate objectives"

这与OpenClaw AGENTS.md中Main Agent的设计困境完全一致。

### Plan-and-Act双模块架构

```
User Query → Planner (高层规划) → Executor (环境动作) → Environment
                  ↑______________________________________|
                        (环境反馈触发动态重规划)
```

| 模块 | 职责 | OpenClaw对应 |
|------|------|-------------|
| **Planner** | 将用户目标分解为结构化高层步骤 | Main Agent任务分解 |
| **Executor** | 将步骤翻译为环境特定动作 | Sub-agent执行 |
| **Replanning** | 每步根据环境反馈动态重规划 | Error Log驱动调整 |

---

## 关键技术贡献

### 1. 合成数据生成管道

论文提出**无需模拟器**即可生成Planner训练数据的方法：

**Grounded Plan Generation**:
- 分析成功动作轨迹(点击、输入序列)
- 使用LLM逆向生成对应的高层计划
- 确保计划与实际可执行动作一致

**Synthetic Augmentation**:
- 以初始计划为种子生成多样化规划示例
- 解决真实世界规划数据稀缺问题

### 2. 动态重规划机制

与静态规划不同，Plan-and-Act每执行一步后：
1. 接收环境反馈(HTML变化)
2. Planner生成**新计划**融入环境变化
3. Executor基于更新计划继续执行

这种**有界迭代**模式与OpenClaw禁止无限递归(P109)一致。

### 3. 与复杂多Agent系统的对比

| 系统 | Agent数量 | 复杂度 | Plan-and-Act评价 |
|------|----------|--------|-----------------|
| WebPilot | 6个 | 高 | "significantly more complex infrastructure" |
| AdaPlanner | 3个+技能发现 | 中高 | "orthogonal to our method" |
| AgentOccam | 1个(树状规划) | 中 | "plans in a tree-like fashion" |
| **Plan-and-Act** | **2个** | **极简** | "simple Plan-and-Act structure at runtime" |

**关键洞察**: 简单双Agent框架 > 复杂多Agent编排

---

## 实验结果

### WebArena-Lite基准

| 方法 | 成功率 | 备注 |
|------|--------|------|
| 前人SOTA | ~50% | 各种复杂架构 |
| **Plan-and-Act** | **57.58%** | 极简双模块 |
| WebVoyager(纯文本) | **81.36%** | 文本-only SOTA |

### 关键消融发现

论文通过对比验证了**显式规划训练**的必要性：
- 直接用LLM生成计划(零样本): 质量不稳定
- 经过合成数据微调的Planner: 显著改进

**结论**: 规划是**可学习的技能**，而非模型固有能力

---

## OpenClaw验证网络

### 架构层验证

| Plan-and-Act机制 | OpenClaw对应 | 验证强度 |
|-----------------|-------------|---------|
| Planner-Executor分离 | Main/Sub-agent架构 | ✅ 完全一致 |
| 动态重规划 | Error Log审计循环 | ✅ 高度对齐 |
| 极简vs复杂多Agent | SYNTH-007 CLI哲学 | ✅ 跨域验证 |
| 合成数据训练 | Skill渐进扩展 | ⚠️ 待探索 |

### 术语辨析

Plan-and-Act的**Replanning** vs OpenClaw的**Self-Evolution**:
- ✅ Plan-and-Act: 每步基于外部反馈调整计划(能力层优化)
- ❌ 非架构自修改: Planner/Executor模块固定
- ✅ 与P109一致: 运行时仅执行，编译期确定架构

### 与SYNTH-007 CLI哲学的呼应

论文明确批判复杂多Agent框架:
> "All of these methods use more excessive prompting to improve performance, while our method has a simple Plan-and-Act structure"

这与SYNTH-007识别的"Cosplay Multi-Agent"批判形成**学术验证**。

---

## L3 Flags

- #1475-A: 评估Plan-and-Act合成数据管道对AGENTS.md优化的启示
- #1475-B: 研究动态重规划与Error Log审计的整合机制
- #1475-C: 探索Planner微调方法在Skill能力扩展中的应用

---

**Archived**: 2026-03-15  
**Cross-ref**: SYNTH-007, HB#1474, HB#1473
