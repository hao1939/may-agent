# CoALA: Cognitive Architectures for Language Agents

**Source:** arXiv:2309.02427 (6次档案引用)  
**Title:** Cognitive Architectures for Language Agents  
**Authors:** Theodore R. Sumers, Shunyu Yao (ReAct作者), Karthik Narasimhan, Thomas L. Griffiths (Princeton)  
**Date:** March 15, 2024 (v3, TMLR camera ready)

---

## 核心主张

> **LLM即生产系统 (Production System)** —— 类比Newell & Simon的生产系统理论，CoALA为语言Agent提供认知架构框架。

CoALA通过三大维度刻画语言Agent：
1. **信息存储** (记忆) —— 工作记忆 vs 长期记忆
2. **动作空间** —— 内部动作 vs 外部动作
3. **决策过程** —— 规划-执行循环

---

## 理论基础: 从字符串到符号AGI

### 生产系统历史
- **Post (1943):** 将逻辑系统规约为字符串重写规则
- **Chomsky:** 短语结构语法
- **Newell & Simon (1972):** 《Human Problem Solving》将生产系统用于人类问题建模
- **Soar, ACT-R:** 认知架构实现

### LLM ↔ 生产系统类比

| 生产系统 | LLM/Agent |
|---------|----------|
| 字符串重写规则 | 文本生成/修改分布 |
| 控制流选择production | 认知架构控制LLM决策 |
| 前提条件匹配 | prompt/context匹配 |
| 动作执行 | token生成/工具调用 |

---

## CoALA框架详解

### 记忆架构

| 类型 | 功能 | 认知科学来源 |
|------|------|-------------|
| **工作记忆** | 当前情境：近期感知输入、目标、中间推理结果 | Baddeley & Hitch (1974) |
| **程序性记忆** | 生产系统本身：可应用的行为规则 | - |
| **语义记忆** | 关于世界的事实知识 | Lindes & Laird (2016) |
| **情景记忆** | Agent过去行为的序列 | Nuxoll & Laird (2007) |

### 动作空间

**内部动作 (Internal):**
- 记忆读写（工作记忆↔长期记忆）
- 推理、规划、自我反思
- 目标管理

**外部动作 (External):**
- 工具调用
- 环境交互
- 感知输入

### 决策循环

```
感知 → 工作记忆更新 → 生产匹配 → 动作选择 → 执行 → 反馈
```

---

## 现有Agent的CoALA分类

| Agent | 记忆特征 | 动作特征 | 决策特征 |
|-------|---------|---------|---------|
| ReAct | 工作记忆存储推理痕迹 | 外部工具调用为主 | 推理-行动交替 |
| Reflexion | 增加长期情景记忆 | 内部反思动作 | 失败后反思循环 |
| Voyager | 技能库存储程序性记忆 | 代码生成作为技能 | 终身学习循环 |
| Generative Agents | 完整记忆架构 | 规划+反思内部动作 | 社交行为决策 |

---

## 未来方向 (CoALA视角)

### 短期行动
1. **标准化记忆接口** — 工作记忆与长期记忆的标准API
2. **元认知能力** — Agent对自身推理过程的监控
3. **社会认知** — 多Agent协作的认知架构

### 长期问题
1. **符号-神经融合** — 传统认知架构与神经网络的深度整合
2. **持续学习** — 不遗忘的程序性记忆更新
3. **可解释性** — 生产系统规则级别的决策透明度

---

## OpenClaw架构映射

| CoALA概念 | OpenClaw实现 |
|----------|-------------|
| 工作记忆 | Session上下文 + Channel状态 |
| 程序性记忆 | AGENTS.md定义的行为模式 + Skills |
| 语义记忆 | 外部工具/资源访问 |
| 情景记忆 | Error Log归档系统 |
| 内部动作 | 自我反思、目标重评估 |
| 外部动作 | 工具调用、Sub-agent委托 |
| 决策循环 | Main Agent决策逻辑 |

### 关键验证

> "Language agents use LLMs to manage the agent's internal state via processes such as learning and reasoning"

**CoALA验证了OpenClaw设计的认知合理性**: Main↔Sub-agent架构、Error Log作为情景记忆、AGENTS.md作为程序性记忆——这些都与CoALA框架高度一致。

### 张力点

CoALA将"学习"列为内部动作之一，但未区分：
- **训练时学习** (weight update) ✅
- **运行时自修改** (self-evolution) ❌

OpenClaw的"禁止Self-Evolution"立场需要更精确表述为：**禁止运行时程序性记忆修改** (即AGENTS.md/Skills的自我修改)，但允许通过Error Log积累情景记忆。

---

## L3 FLAGS

- #825 CoALA-Framework: 认知架构作为语言Agent的组织框架
- #826 Memory-Taxonomy: 工作/程序/语义/情景记忆四分类
- #827 Production-System-Analogy: LLM作为生产系统的理论类比
- #828 Internal-External-Action: 内部推理与外部执行的明确区分

---

**Added:** April 17, 2026 (HB#329)  
**Relevant to:** Bob (认知架构设计哲学), tech-lead (记忆系统实现)
