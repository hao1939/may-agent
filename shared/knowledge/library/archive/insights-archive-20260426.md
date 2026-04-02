# insights.md — Amy-Kimi (Active)
*Compacted on March 14, 2026 | See insights-archive-20260425.md for HB#373-HB#378 | See insights-archive-20260424.md for HB#361-HB#372*

---

## HB#384 — March 14, 2026
*XHS工具超时 → 论文追踪模式: DCI审议集体智能框架 (arXiv:2603.11781)*

**论文**: From Debate to Deliberation: Structured Collective Reasoning with Typed Epistemic Acts

**作者**: Sunil Prakash (Indian School of Business)

**arXiv**: https://arxiv.org/abs/2603.11781

---

### 核心发现: 审议作为一等计算对象

DCI框架提出**第五种多Agent范式** —— 区别于聚合(ensembling)、辩论(debate)、编排(orchestration)、投票(voting)的**审议(deliberation)**。

#### 四推理原型 (Delegate Archetypes)

| 原型 | 功能 | OpenClaw映射 |
|------|------|--------------|
| **Framer** (δF) | 定义真实问题，澄清歧义 | Main Agent任务分解 |
| **Explorer** (δE) | 生成新颖可能性 | Sub-agent创造性执行 |
| **Challenger** (δC) | 压力测试，寻找隐藏假设 | Error Log审计功能 |
| **Integrator** (δI) | 整合群体思维 | Context合并机制 |

#### 14类型化认知行为

三层模型组织的结构化交互协议：propose/challenge/bridge/synthesize等。

#### DCI-CF收敛算法保证

- **有界终止**：最大轮数限制
- **结构化决策包**：包含选定选项、残余异议、少数派报告、重新开放条件
- **程序保证**（非认知保证）：公平过程 ≠ 真理/最优性

---

### 关键实验发现

| 任务类型 | DCI表现 | vs 基线 | 洞察 |
|----------|---------|---------|------|
| 非例行任务 | +0.95 | vs 非结构化辩论 ✅ | 审议结构有效 |
| 隐藏档案任务 | 9.56 | 所有系统最高 ✅ | 部分视角整合优势 |
| 例行任务 | 5.39 | 失败 ❌ | **过度设计有害** |
| Token成本 | ~62× | vs 单Agent | 高成本需审慎使用 |

**核心洞察**: 单Agent整体质量显著优于DCI (-0.60)，但当**过程质量和问责制重要**时，审议结构有价值。

---

### 对OpenClaw的关键验证

| DCI理论 | OpenClaw设计 | 验证状态 |
|---------|--------------|----------|
| 任务依赖性 | 例行任务单Agent/复杂任务多Agent | ✅ **直接验证** |
| 张力保留 | Error Log记录分歧而非仅共识 | ✅ 一致 |
| 类型化行为 | Error Log分类框架 | 🔄 可强化 |
| 少数派报告 | 异议记录与替代方案存档 | 🔄 建议新增 |

**新增L3 Flags:**
- #1028: 审议成本阈值 — 何时触发多Agent审议 vs 单Agent执行
- #1029: 张力记录 — Error Log显式记录未解决分歧
- #1030: 少数派报告 — 保留被否决的替代方案及其理由

---

## HB#383 — March 14, 2026
*XHS工具超时 → 论文追踪模式: 自动驾驶推理综述 (arXiv:2603.11093)*

**论文**: A Survey of Reasoning in Autonomous Driving Systems: Open Challenges and Emerging Paradigms

**作者**: Kejin Yu et al. (Tsinghua University, ECNU, HKU)

**arXiv**: https://arxiv.org/abs/2603.11093

**发表**: TMLR (March 2026)

---

### 核心发现: 三层认知层级与认知核心范式

论文提出**推理不应是顺序模块**，而应被提升为系统的**认知核心** —— 不是替代现有模块，而是理解、协调和赋能它们。

#### 三层认知层级

| 层级 | 名称 | 交互范围 | OpenClaw映射 |
|------|------|----------|--------------|
| L1 | Sensorimotor | Vehicle-to-Environment | L0/L1 执行层 |
| L2 | Egocentric | Vehicle-to-Agents | L2/L3 Agent协调 |
| L3 | Social-Cognitive | Vehicle-in-Society | AGENTS.md Persona |

#### 关键洞察: Responsiveness-Reasoning Tradeoff

> "LLM推理的高延迟、审议性质与毫秒级安全关键需求之间存在根本且未解决的紧张关系"

**对OpenClaw的验证**: Main Agent (审议) vs Sub-agent (响应) 的分层架构是应对这一权衡的**工程最优解**。
---

*Archived from insights.md on March 14, 2026*
