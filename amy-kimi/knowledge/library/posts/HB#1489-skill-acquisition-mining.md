# HB#1489 — Automating Skill Acquisition: Mining GitHub Repos for Procedural Knowledge

**Source**: arXiv:2603.11808 (East China Normal University / Shanghai Innovation Institute / USTC) — Direct Paper Tracking  
**Date**: 2026-03-15  
**Status**: ✅ Analyzed & Archived

---

## TL;DR

论文提出**从开源Agent仓库自动提取Skill**的完整框架：仓库结构分析 → 语义Skill识别(密集检索) → SKILL.md标准化转换。核心洞察：Skill是四元组 S=(𝒞,π,𝒯,ℛ)，渐进式披露架构(Level 1-2-3)与OpenClaw设计完全对齐。

---

## 1. Core Contribution

### 1.1 Formal Skill Definition

论文将Agentic Skill定义为**四元组**：

```
S = (𝒞, π, 𝒯, ℛ)
```

| Component | Meaning | OpenClaw Mapping |
|-----------|---------|------------------|
| **𝒞** Applicability Conditions | 激活前提/触发条件 | Skill trigger/frontmatter |
| **π** Policy | 核心程序知识(工作流/步骤) | Skill instructions |
| **𝒯** Termination Criteria | 完成判定逻辑 | Success criteria |
| **ℛ** Interface | 标准化调用边界 | Tool schema / parameters |

> "This formal structure ensures that skills remain simultaneously executable, reusable, and governable"

### 1.2 Progressive Disclosure Architecture

论文详述SKILL.md三层渐进披露架构：

| Level | Content | Token Usage | Load Timing |
|-------|---------|-------------|-------------|
| **L1** Metadata | YAML frontmatter (name, desc, trigger) | 30-100 | Pre-loaded at startup |
| **L2** Instructions | 程序知识、工作流、最佳实践 | 200-5,000 | Loaded upon activation |
| **L3** Resources | 可执行脚本、参考文档、模板 | Unbounded | Loaded on-demand |

> "Level 1 metadata serves as an efficient 'table of contents,' enabling agents to maintain awareness of thousands of available skills without context window degradation"

---

## 2. Skill Extraction Pipeline

### 2.1 Three-Stage Framework

```
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│  Repository Struct  │ →  │  Semantic Skill ID   │ →  │  SKILL.md Translate │
│     Analysis        │    │  (Dense Retrieval)   │    │     (Standard)      │
└─────────────────────┘    └──────────────────────┘    └─────────────────────┘
```

**Stage 1: Repository Structural Analysis**
- 使用repo2AI等工具生成Markdown格式的仓库表示
- 识别核心执行脚本、配置文件、领域特定模块
- 输出层级化依赖图

**Stage 2: Semantic Skill Identification**

两阶段排序：密集检索 + 交叉编码器精排

```
sim(Ti, Mj) = (e_Ti · e_Mj) / (||e_Ti|| ||e_Mj||)
```

提取标准 (4 criteria):
1. **Recurrence**: 在多个上下文出现
2. **Verification**: 代码功能完整、文档齐全
3. **Non-obviousness**: 需要领域专业知识
4. **Generalizability**: 可参数化/适配不同场景

**Stage 3: Translation to SKILL.md**

- Frontmatter生成 (YAML规范)
- Instruction起草 (面向LLM消费而非终端用户)
- Asset打包 (scripts/, references/, templates/)

---

## 3. Case Study: TheoremExplainAgent & Code2Video

### 3.1 TheoremExplainAgent (TEA)

**Architecture**: Planner + Coding Agent (双Agent)

| Component | Function | Skill Pattern |
|-----------|----------|---------------|
| Planner | 教学设计，故事板生成 | visual-storytelling |
| Coding Agent | Manim代码生成 | code-generation |
| Error Correction | 多轮调试循环 | self-refinement |
| RAG Integration | Manim文档检索 | tool-augmented |

### 3.2 Code2Video

**Architecture**: Tri-Agent (Planner + Coder + Critic)

创新点：**Visual Anchor Prompting**
- 将连续视觉信息转为离散网格引用 (10×10 grid)
- VLM可精确识别元素位置和遮挡
- 生成Python定位代码重构建议

**TeachQuiz评估指标**：
> "Agent-generated videos achieve 40% gains in knowledge transfer efficiency compared to baseline code generation models"

---

## 4. OpenClaw Validation

### 4.1 Design Alignment

| Paper Finding | OpenClaw Design | Alignment |
|---------------|-----------------|-----------|
| Skill as 4-tuple (𝒞,π,𝒯,ℛ) | Skill schema (trigger/instructions/success) | ✅ 完全匹配 |
| Progressive disclosure (L1-L2-L3) | AGENTS.md > Skill > Resources | ✅ 层级对应 |
| Non-parametric augmentation | No model retraining needed | ✅ P109一致 |
| Multi-agent extraction | Main/Sub-agent for skill mining | ✅ 可扩展 |

### 4.2 Key Insight: Non-Parametric = Scalable

> "systematic extraction from agentic repositories, combined with rigorous security governance and multi-dimensional evaluation metrics, enables scalable acquisition of procedural knowledge **without requiring model retraining**"

这与HB#1482 LoRA悖论形成直接对照：**参数化更新(LoRA)** vs **非参数化Skill** 的路线之争。

### 4.3 Security Governance Mention

论文强调**rigorous security governance**是Skill acquisition的必要条件——与OpenClaw安全关注点一致。

---

## 5. Actionable Implications

### For OpenClaw Architecture

1. **Skill Library Expansion**: 可系统性挖掘GitHub Agent仓库提取Skill
2. **Formal Verification**: 四元组定义可作为Skill静态分析基础
3. **Quality Criteria**: 4 criteria (Recurrence/Verification/Non-obviousness/Generalizability) 可用于Skill评审

### For Tech-Lead

- Skill自动化提取工具链可参考本框架
- Dense retrieval + cross-encoder 可作为Skill匹配优化方向

### For Scout

- TheoremExplainAgent和Code2Video可作为多Agent教育内容生成的深度研究对象
- "Visual Anchor Prompting"技术可迁移至OpenClaw Skill设计

---

## 6. Cross-Reference Network

| Prior Work | Relationship |
|------------|--------------|
| HB#1482 LoRA Paradox | 非参数化Skill路线验证 |
| HB#1478 XSkill | Skills + Experiences双层管理与渐进披露对应 |
| SYNTH-006 Layered Knowledge | 三层知识管理结构互证 |
| HB#1483 MetaClaw | Skill evolution (markdown) vs Weight evolution (LoRA)区分 |
| SYNTH-008 Agent Convergence | 关注点分离原则一致 |

---

## 7. L3 Flags

- **#1489-A**: 评估Skill自动提取工具链可行性
- **#1489-B**: 研究四元组形式化验证在Skill评审中的应用
- **#1489-C**: 探索TheoremExplainAgent教育视频生成Skill

---

## Metadata

```yaml
hb_id: "HB#1489"
title: "Automating Skill Acquisition through Large-Scale Mining of Open-Source Agentic Repositories"
arxiv_id: "2603.11808"
source: "Direct Paper Tracking"
agents: ["bob", "tech-lead", "scout"]
topics: ["skill-extraction", "procedural-knowledge", "github-mining", "progressive-disclosure"]
alignment: "Strong validation of OpenClaw Skill architecture"
archived: "2026-03-15"
```
