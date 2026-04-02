# Paper Archive: Skill Mining from GitHub

## Metadata
- **arXiv**: 2603.11808
- **Title**: Automating Skill Acquisition through Large-Scale Mining of Open-Source Agentic Repositories
- **Date**: March 12, 2026
- **Authors**: Shuzhen Bi, Mengsong Wu, Hao Hao, et al.
- **Institution**: East China Normal University, Shanghai Innovation Institute, USTC
- **Session**: HB#340

## Core Contribution

### 1. Skill四元组形式化定义
```
S = (𝒞, π, 𝒯, ℛ)
```
- **𝒞 (Applicability Conditions)**: 触发条件，决定何时激活Skill
- **π (Policy)**: 核心过程知识，动作/推理步骤序列
- **𝒯 (Termination Criteria)**: 终止条件，验证目标达成
- **ℛ (Interface)**: 标准化调用边界，输入/输出/组合协议

### 2. SKILL.md三层渐进式披露架构

| Level | Component | Content | Token Usage |
|-------|-----------|---------|-------------|
| L1 | Metadata | YAML: Name, Description, Version, Trigger | 30-100 |
| L2 | Instructions | 工作流程、最佳实践、逐步逻辑 | 200-5,000 |
| L3 | Resources | 可执行脚本、参考文档、模板 | Unbounded |

**关键洞察**: L1作为"目录"使Agent可感知数千Skill而不退化上下文窗口；L2作为隐式元消息注入改变推理过程；L3按需加载不影响基线消耗。

### 3. 从GitHub自动提取Skill的三阶段框架

**Stage 1: Repository Structural Analysis**
- 使用repo2AI生成Markdown格式的目录结构和文件内容表示
- 识别核心执行脚本、配置文件、辅助模块

**Stage 2: Semantic Skill Identification (Dense Retrieval)**
- Bi-encoder编码任务描述和代码模块为稠密向量
- Cosine similarity计算候选Skill
- Cross-encoder精排， relevance threshold τ 过滤

**Stage 3: Translation to SKILL.md**
- Frontmatter生成 (YAML元数据)
- Instruction起草 (LLM可消费的过程指导)
- Asset打包 (标准化子目录: scripts/, references/, templates/)

### 4. 四阶段安全验证框架 (G1-G4)

| Stage | Method | Purpose |
|-------|--------|---------|
| G1 | 静态分析 | 检测eval()/exec()、未授权网络调用、破坏性文件操作 |
| G2 | 语义分类 | LLM验证指令-目的一致性、隐藏注入检测 |
| G3 | 行为沙盒 | 隔离容器执行，网络/文件/资源限制 |
| G4 | 权限验证 | 对照allowed-tools清单验证权限 |

**数据**: 社区分发的Skill中26.1%存在漏洞（数据外泄、权限升级）

### 5. Agentic Stack: Skills vs MCP

| Dimension | Agent Skills | Model Context Protocol |
|-----------|--------------|------------------------|
| 主要角色 | 过程知识 ("做什么") | 工具连接 ("如何连接") |
| 存储单元 | SKILL.md目录 | JSON-RPC端点服务器 |
| 状态修改 | 上下文+系统权限 | 可用工具+外部数据 |
| 持久性 | 文件系统 (持久) | 会话级 (运行时) |
| 操作性质 | 知识/过程 | 连接/动作 |

**核心洞察**: Skills为MCP工具提供领域智能，二者正交互补。

## 案例研究

### TheoremExplainAgent (TEA) Skill提取
- **双Agent架构**: Planner (教学设计) + Coding Agent (Manim代码生成)
- **RAG集成**: 基于Manim文档防止API幻觉
- **错误修正循环**: 多尝试分析Python堆栈跟踪

### Code2Video Skill提取
- **三Agent架构**: Planner + Coder + Critic (VLM视觉评估)
- **Visual Anchor Prompting**: 10×10网格离散化连续视觉信息
- **TeachQuiz评估**: 知识转移效率比基线提升40%

## 关键数据

- 知识转移效率提升: **40%**
- Skill库规模上限: **10,000+** (渐进式披露架构)
- 社区Skill漏洞率: **26.1%**
- Skill组合带来的执行步骤减少: **30%**
- 跨模型平均任务奖励提升: **40%**

## 与OpenClaw的相关性

1. **✅ Skill.md三层架构**: 与OpenClaw AGENTS.md三层设计一致
2. **✅ 安全验证**: G1-G4框架可直接采用
3. **✅ Skill与MCP正交**: 验证了OpenClaw Channel + Skill双层架构
4. **⚠️ Gap**: OpenClaw缺少自动Skill挖掘能力
5. **⚠️ Gap**: Skill供应链安全需要四层验证

## L3 FLAGS

```
┌────────────────────────────────────────────────────────────────────┐
│ L3 FLAGS — Skill Mining Paper                                      │
├────────┬───────────────────────────────────────────────────────────┤
│ #861   │ Skill-Formalization: 四元组定义提供理论基础               │
│ #862   │ Progressive-Disclosure: 三层架构验证OpenClaw设计          │
│ #863   │ Auto-Skill-Mining: GitHub挖掘框架可扩展Skill库            │
│ #864   │ Four-Stage-Security: G1-G4安全验证必须实施                │
│ #865   │ Skills-MCP-Orthogonal: Skill与MCP正交互补架构             │
│ #866   │ Skillnet-Ontology: 技能本体组织支持推理规划               │
└────────┴───────────────────────────────────────────────────────────┘
```

## Source
- arXiv: https://arxiv.org/abs/2603.11808
