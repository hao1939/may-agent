# HB#1688 — AI Planning Framework for LLM-Based Web Agents

**Source**: arXiv:2603.12710v1 (13 Mar 2026)  
**Authors**: Orit Shahnovsky, Rotem Dror (University of Haifa)  
**Tags**: #Planning #Evaluation #WebAgent #Taxonomy  
**Heat**: 🔥🔥🔥🔥🔥

---

## 核心贡献

论文建立了一个将现代LLM Agent架构映射到传统AI规划范式的统一分类法，并提出了超越简单成功/失败的评估框架。

### 三大规划范式映射

| Agent架构 | 传统规划范式 | 关键特征 | OpenClaw映射 |
|-----------|-------------|---------|-------------|
| **Step-by-Step** | BFS (广度优先搜索) | 逐步探索，上下文渐进构建 | Skill顺序执行 |
| **Tree Search** | Best-First Tree Search | 多路径评估，选择最优 | Error Log分支分析? |
| **Full-Plan-in-Advance** | DFS (深度优先搜索) | 预生成完整计划再执行 | DAG Workflow |

### 关键发现

**Step-by-Step vs Full-Plan-in-Advance对比实验**:
- Step-by-Step: **38.41%整体成功率**，更符合人类黄金轨迹
- Full-Plan-in-Advance: **89%元素准确率**，技术指标更优

**核心洞察**: 
> "The methodology of the agent determines how well it resists context drift... Any algorithm that forces the agent to stick to a plan can help it stay aligned with the original intent even after many steps."

### 失败诊断框架

论文将Agent失败归因于两个来源：
1. **规划执行逻辑的根本缺陷** — 可通过架构选择缓解
2. **LLM幻觉引入的外部噪声** — 需通过评估指标检测

**Context Drift (上下文漂移)** 被确认为关键失败模式：
> "Over many steps, the original goal simply falls out of memory, replaced by the most recent instructions."

### 五项新评估指标

论文提出了超越二元的pass/fail评估的指标框架：
1. 轨迹质量评估 (Trajectory Quality)
2. 计划连贯性 (Plan Coherence) 
3. 执行效率 (Execution Efficiency)
4. 错误恢复能力 (Error Recovery)
5. 与人类轨迹的对齐度 (Human Alignment)

### 数据集贡献

- **794条人工标注轨迹** (基于WebArena benchmark)
- 人类黄金标准执行路径
- 用于跨架构范式的细粒度benchmark

---

## OpenClaw相关性分析

### 结构同构验证

OpenClaw的DAG-based workflow设计**直接对应** Full-Plan-in-Advance (DFS) 范式：
- ✅ 预定义完整执行路径
- ✅ 强制按计划执行，抵抗context drift
- ✅ 与论文"stick to a plan"建议一致

### 关键张力

| 论文发现 | OpenClaw现状 | 建议 |
|---------|-------------|------|
| Step-by-Step更符合人类行为 | DAG预定义可能过于刚性 | 考虑动态子workflow插入机制 |
| Full-Plan技术准确率更高 | 当前设计正确 | 保持，但增加执行中调整能力 |
| Context drift是主要失败源 | Error Log作为漂移检测 | 强化L2后验诊断的漂移识别 |

### 评估框架借鉴

论文的"LLM-as-judge"评估方法与OpenClaw L3人工审计**结构相似**：
- 比较Agent轨迹vs人类黄金轨迹
- 语义等价性判断
- 细粒度步骤评估

---

## 技术细节

### 规划范式详解

**BFS-based (Step-by-Step)**:
- 每次扩展一层可能的动作
- 保持多个候选路径
- 适合探索性任务

**DFS-based (Full-Plan-in-Advance)**:
- 预生成完整深度路径
- 单一路径执行到底
- 适合确定性任务

**Best-First Tree Search**:
- 评估函数引导路径选择
- 动态剪枝
- 平衡探索与利用

### 失败模式分类

| 失败类型 | 描述 | 论文解决方案 |
|---------|------|-------------|
| Context Drift | 长期执行中遗忘原始目标 | 强制plan adherence |
| Incoherent Decomposition | 任务分解不一致 | 预规划验证 |
| Hallucination | LLM生成虚假内容 | 外部验证机制 |

---

## 引用原文

> "We introduce a taxonomy that maps modern agent architectures to traditional planning paradigms: Step-by-Step agents to Breadth-First Search (BFS), Tree Search agents to Best-First Tree Search, and Full-Plan-in-Advance agents to Depth-First Search (DFS)."

> "Any algorithm that forces the agent to stick to a plan can help it stay aligned with the original intent even after many steps."

> "The coarse binary evaluation inherently limits insight into agent behavior. For example, if a goal requires listing five reviews and the agent correctly retrieves four, the agent receives no recognition for the substantial progress made."

---

**Archive Date**: 2026-03-16  
**Session ID**: s_1773675815301_233  
**Related**: HB#1681 (ToolTree), HB#1676 (CogSearch)
