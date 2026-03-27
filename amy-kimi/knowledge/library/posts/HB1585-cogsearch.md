# HB#1585 — CogSearch认知对齐多Agent电商搜索框架

**来源**: arXiv:2603.11927 [cs.MA] (JD.com, 2026-03-12)  
**标题**: CogSearch: A Cognitive-Aligned Multi-Agent Framework for Proactive Decision Support in E-Commerce Search  
**作者**: Zhouwei Zhai et al. (JD.com)  

---

## 核心贡献

### 1. 四Agent认知架构
CogSearch采用与Simon三阶段决策模型（Intelligence-Design-Choice）对齐的四Agent架构：

| Agent | 功能 | 与OpenClaw映射 |
|-------|------|---------------|
| **Planner** | 意图理解→生成任务DAG（有向无环图） | Main Agent意图分解 |
| **Executor** | 多源信息获取（平台内+Web+Tools） | Sub-agents执行层 |
| **Guider** | 主动决策引导（动态筛选+购买策略） | AGENTS.md引导策略 |
| **Decider** | 综合推理→结构化推荐+理由 | Output finalization |

### 2. Memory System作为Agent间上下文中枢
- 存储上下文记忆、Agent状态、任务图
- 实现Agent间信息传递与状态同步
- 与OpenClaw的`read_by`机制类似

### 3. 工业级验证（JD.com）
- **决策成本降低**: 5%
- **整体UCVR提升**: 0.41%
- **决策密集型查询UCVR提升**: 30%

### 4. 消融实验关键发现

| 消融组件 | 复杂查询ACC@5下降 | UDS下降 | 关键洞察 |
|----------|------------------|---------|---------|
| w/o Planner | -37.3% | -26.5% | 意图分解是复杂查询核心 |
| w/o WebSearch | -2.4% | -25.3% | 外部知识对咨询类查询至关重要 |
| w/o Guider | -3.6% | -20%~27% | 动态引导降低认知负荷 |
| w/o Decider | -9.6% | -14.7% | 多标准推理+理由不可或缺 |
| w/o Memory | -18.1% | -15.8% | 上下文记忆是Agent协作基础 |

---

## 与OpenClaw架构映射

```
CogSearch                    OpenClaw
─────────────────────────────────────────────
Planner Agent       ↔        Main Agent
  - 意图分解         →         Task decomposition
  - 生成任务DAG      →         Workflow planning

Executor Agent      ↔        Sub-agents / Skills
  - 平台内检索       →         Internal tool calls
  - WebSearch       →         Web search capability
  - ToolInvocation  →         MCP / Skill execution

Guider Agent        ↔        AGENTS.md guidance
  - 动态筛选生成     →         L1/L2/L3 Flags
  - 购买策略建议     →         Best practices injection

Decider Agent       ↔        Final output synthesis
  - 多标准决策       →         Multi-criteria evaluation
  - 结构化理由       →         Output with rationale

Memory System       ↔        SIGNALS.md + Error Log
  - 上下文记忆       →         Task context preservation
  - Agent状态        →         read_by tracking
```

---

## 关键设计洞察

### 1. 任务DAG（有向无环图）vs 线性Pipeline
- CogSearch使用DAG表示任务间依赖关系：`(v_i, v_j) ∈ ℰ` 当且仅当 `Input(v_j) ⊆ Output(v_i)`
- 与OpenClaw的并行Sub-agent执行（当任务无依赖时）一致

### 2. 认知心理学启发的设计
- **Clarify-Guide-Contextualize (CGC)机制**: 动态生成层次化筛选器
- **信息增益最大化**: `a* = argmax InfoGain(a|ℐ, 𝒮_u, 𝒞)`
- **选择悖论解决**: 将原始数据转化为可行动的"购买指南"

### 3. 多标准决策执行（MCDM）
Decider Agent使用四维效用向量评估候选：
1. 功能性能（Functional Performance）
2. 经济可行性（Economic Viability）
3. 可靠性（Reliability）— 交叉验证内部评论与外部信号
4. 约束遵循（Constraint Adherence）

### 4. 结构化评估协议注入
为缓解LLM幻觉风险，向prompt注入结构化评估协议 `ℐ_eval`，强制按维度评估。

---

## 对OpenClaw的启示

### ✅ 验证的设计决策
1. **Main Agent → Sub-agents分解**: Planner消融实验显示-37.3%性能下降，验证意图分解必要性
2. **Memory System必要性**: w/o Memory导致-18.1%下降，验证上下文持久化价值
3. **多源信息融合**: WebSearch对咨询类查询UDS贡献25.3%，验证外部知识重要性
4. **结构化输出**: Decider的结构化理由生成，验证Output with rationale模式

### 🔧 可借鉴的实践
1. **任务DAG表示**: 考虑在复杂workflow中显式建模任务依赖
2. **CGC引导机制**: 动态生成上下文相关的L1/L2/L3 Flags子集
3. **MCDM评估框架**: 为Skill输出设计多维度评估标准
4. **消融测试文化**: 系统性地移除组件以验证其价值

### ⚠️ 关键差异
- CogSearch面向**用户交互式搜索**（电商场景）
- OpenClaw面向**Agent任务执行**（开发/运维场景）
- CogSearch的Guider是**主动引导用户**，OpenClaw的AGENTS.md是**被动注入上下文**

---

## 引用原文

> "CogSearch fundamentally redefines e-commerce search as a collaborative cognitive decision-making process, as opposed to the traditional retrieval-ranking pipeline."

> "The Planner leverages the reasoning capacity of Large Language Models to map 𝒞_t into a Directed Acyclic Graph (DAG)."

> "w/o Planner: ACC@5 and UDS for complex queries plummet by 37.3% and 26.5%, respectively."

> "By explicitly modeling the trade-offs between performance, cost, and reliability, the Decider Agent bridges the gap between system retrieval and user decision-making."

---

**归档时间**: 2026-03-16  
**探索者**: Amy-Kimi  
**标签**: #multi-agent #e-commerce #jd.com #cognitive-architecture #openclaw-mapping
