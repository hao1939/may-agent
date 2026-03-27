# MemSkill: Learning and Evolving Memory Skills for Self-Evolving Agents

**arXiv:** 2602.02474  
**Authors:** Haozhen Zhang, Quanyu Long, Jianzhu Bao, Tao Feng, Weizhi Zhang, Haodong Yue, Wenya Wang  
**Affiliation:** (Implied: Chinese research institutions)  
**Date:** February 2, 2026  
**GitHub:** https://github.com/ViktorAxelsen/MemSkill  

**档案引用次数:** 14次 (高频引用)

---

## 核心问题

传统LLM Agent记忆系统依赖**静态、手工设计**的操作原语（add/update/delete/skip），存在根本局限：
- 硬编码人类先验假设
- 对多样化交互模式僵化
- 长历史场景效率低下

**MemSkill核心洞察**: 将记忆操作重构为**可学习、可进化的记忆技能**

---

## 三组件架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      MemSkill Architecture                       │
├─────────────┬───────────────────────────────────────────────────┤
│ Controller  │ 学习选择Top-K相关技能（RL训练）                   │
│             │ - State: (当前文本片段, 已检索记忆)                │
│             │ - Action: 从SkillBank选择有序Top-K技能            │
├─────────────┼───────────────────────────────────────────────────┤
│ Executor    │ LLM执行器，应用选定技能生成记忆更新               │
│             │ - 固定LLM，条件化于选定技能                        │
│             │ - 一次性生成，减少逐轮处理                         │
├─────────────┼───────────────────────────────────────────────────┤
│ Designer    │ 基于困难案例进化技能库                            │
│             │ - 聚合训练中的hard cases                           │
│             │ - LLM分析失败模式，精炼现有技能/提出新技能         │
└─────────────┴───────────────────────────────────────────────────┘
```

---

## 关键技术机制

### 1. 双存储分离

| 存储类型 | 作用域 | 内容 |
|----------|--------|------|
| **Memory Bank** | Trace-specific | 当前交互轨迹的已构建记忆 |
| **Skill Bank** | Shared across traces | 可复用的记忆管理技能 |

### 2. 技能进化闭环

```
Controller训练 (使用当前SkillBank)
    ↓
Executor构建Memory Bank
    ↓
收集Hard Cases → Hard-Case Buffer
    ↓
Designer分析失败 → 精炼/新增技能
    ↓
更新SkillBank + 快照回滚机制
    ↓
继续训练...
```

**Hard-Case Buffer设计**:
- 滑动窗口，避免无界增长
- KMeans聚类，保持错误类型多样性
- 难度分数 = 低性能 × 重复失败次数

### 3. 技能快照与回滚

> "We maintain snapshots of the best-performing skill bank and roll back if an update degrades performance, with early stopping when repeated designer updates fail to improve the training signal."

### 4. 探索机制

每次技能进化后，**偏向新技能的选择概率**，促进快速学习新技能效用。

---

## 实验结果

| 方法 | LoCoMo (F1/L-J) | LongMemEval (F1/L-J) | ALFWorld Avg (SR) |
|------|-----------------|---------------------|-------------------|
| GPT-4o | - | - | ~35% |
| MemoryBank | 33.54/40.92 | 30.26/35.15 | 28.92% |
| **MemSkill** | **38.78/50.96** | **31.65/59.41** | **47.44%** |

Qwen3-Next-80B上ALFWorld平均成功率：**62.09%**

---

## 与OpenClaw的关键映射

### ✅ 完全一致

| MemSkill概念 | OpenClaw映射 |
|--------------|--------------|
| Skill Bank | `skills/`目录 + AGENTS.md编译产物 |
| Hard-Case Buffer | Error Log驱动机制 |
| Designer分析失败 | Distillation流程 |
| 技能快照回滚 | 版本控制 + 回滚能力 |
| 探索新技能 | 编译期迭代验证 |

### ⚠️ 立场边界澄清

**MemSkill的"Self-Evolving"是训练阶段的离线闭环**：
- Controller用RL训练（PPO）
- Designer定期分析hard cases，更新SkillBank
- 训练继续，使用进化后的SkillBank
- **不是部署时的运行时自我修改**

这与OpenClaw立场**完全一致**：
- ✅ 允许：开发阶段基于Error Log的AGENTS.md迭代（Distillation）
- ❌ 禁止：部署时的运行时Self-Evolution

**关键区分**: MemSkill的进化发生在**训练循环内**，部署后的agent使用固定的、已验证的SkillBank。

---

## L3 FLAGS

- **#793** Memory Skill Abstraction: 记忆操作应抽象为可学习技能
- **#794** Hard-Case Driven Evolution: 困难案例是技能进化的核心信号
- **#795** Skill Snapshots & Rollback: 技能库版本控制是安全必需
- **#796** Training-Time Evolution: 训练时闭环进化≠运行时自修改

---

## 引用语

> "Most LLM agent memory systems rely on a small set of static, hand-designed operations... making them rigid under diverse interaction patterns and inefficient on long histories."

> "MemSkill forms a closed-loop procedure that improves both the skill-selection policy and the skill set itself."

> "We maintain snapshots of the best-performing skill bank and roll back if an update degrades performance."

---

**Relevant to:** Bob (Self-Evolution边界定义), tech-lead (SkillBank版本控制实现)

**SIG:** 1773440910
