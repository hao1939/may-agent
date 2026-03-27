# XSkill: Continual Learning from Experience and Skills in Multimodal Agents

**Source:** arXiv:2603.12056  
**Authors:** Guanyu Jiang, Zhaochen Su, Xiaoye Qu, Yi R. (May) Fung  
**Date:** March 12, 2026  
**Archived:** 2026-03-14 (HB#347)  
**SIG:** 1773451921:0a3ab536

---

## Core Contribution

XSkill提出双知识流框架，统一**Experience**（动作级指导）和**Skill**（任务级指导），实现多模态Agent的持续学习。

### 两大知识类型

| 类型 | Experience | Skill |
|------|------------|-------|
| **层级** | 动作级 | 任务级 |
| **作用** | 工具选择、决策制定 | 规划、工具编排 |
| **格式** | JSON (condition, action, embedding) | Markdown (metadata, workflow, templates) |
| **特点** | 简洁、上下文敏感 | 结构化、可复用 |

---

## Key Technical Details

### 双MLLM架构

```
MLLM_exec ──→ 工具执行推理
MLLM_kb  ──→ 知识库操作（提取/整合/适配）
```

- **分离优势**: 知识管理可用更强模型，执行模型保持灵活
- **跨模型迁移**: 一个模型积累的知识可造福其他模型

### Phase I: Knowledge Accumulation

**1. Rollout Summary (视觉 grounded)**
- 多路径rollout收集轨迹
- MLLM_kb分析图像+文本，提取决策点和工具使用模式
- 不仅记录"做了什么"，还记录"视觉证据如何驱动决策"

**2. Cross-Rollout Critique**
- 对比成功/失败轨迹
- 识别因果因素
- 输出结构化Experience更新 (add/modify)

**3. Knowledge Consolidation**
- Experience: 余弦相似度>θ_sim时合并
- Skill: 片段整合到全局文档，自评估通用性/正确性/简洁性

### Phase II: Inference

**1. Task Decomposition Retrieval**
- 任务分解为抽象子任务（如：暗图处理、几何比较、错误恢复）
- 子任务级检索，提高覆盖率

**2. Experience Rewrite**
- 通用Experience → 当前任务适配
- 重写条件匹配当前视觉状态
- 实例化任务相关细节

**3. Skill Adaptation**
- 剪枝无关section
- 将重写后的Experience集成到workflow步骤
- 调整代码模板

**4. Non-Prescriptive Injection**
- 作为参考注入，而非强制指令
- 允许Agent在情况偏离时即兴创新

---

## Performance Results

| Model | Baseline | XSkill | Δ |
|-------|----------|--------|---|
| Gemini-2.5-Pro | 24.99 | 28.63 | **+3.64** |
| Gemini-3-Flash | 34.88 | 40.34 | **+5.46** |
| GPT-5-mini | 20.87 | 23.19 | **+2.32** |
| o4-mini | 20.55 | 23.72 | **+3.17** |

*Average@4 across 4 benchmarks (VisualToolBench, TIR-Bench, MMSearch-Plus, AgentVista)*

最大增益达**+11.13 points**（挑战设置）。

### Ablation Insights
- Skills + Experiences > Skills only > Experiences only > 无知识
- 两者互补：Skills提升规划稳定性，Experiences提升工具选择灵活性

---

## OpenClaw Architecture Mapping

| XSkill Component | OpenClaw Equivalent | Notes |
|------------------|---------------------|-------|
| **Skill Library (𝒦)** | `skills/` + `SKILL.md` | 结构化任务级指导 ✅ |
| **Experience Bank (ℰ)** | `Error Log` + 运行时反馈 | 动作级战术知识 ✅ |
| **MLLM_kb** | Bob (架构设计) | 知识管理层 |
| **MLLM_exec** | Agent执行 | 推理执行层 |
| **Cross-Rollout Critique** | Error Log分析 → AGENTS.md更新 | 失败分析驱动改进 ✅ |
| **Task Decomposition** | Main/Sub-agent委托 | 任务分解检索 |
| **Experience Rewrite** | Context适配 | 当前Context下的动态适配 |
| **Non-Prescriptive Injection** | AGENTS.md引导而非强制 | 允许即兴创新 ✅ |

### 关键验证

1. **双知识流必要性** ✅
   - Skill（结构化）和Experience（战术性）互补
   - 与OpenClaw的SKILL.md + Error Log设计一致

2. **视觉Grounding重要性** ⚠️
   - 多模态Agent必须从视觉观察中提取知识
   - OpenClaw当前纯文本，未来多模态扩展需考虑

3. **知识管理层分离** ✅
   - MLLM_kb与MLLM_exec分离
   - 与Bob架构层设计一致

4. **非指令式注入** ✅
   - 知识作为参考而非强制
   - 保留Agent即兴能力
   - 与"禁止运行时Self-Evolution但允许引导"立场一致

---

## Critical Distinction: Training-Time vs Deployment-Time

XSkill的"持续学习"发生在**非参数更新**层面：
- 知识库（Skill + Experience）持续积累
- 基础模型参数冻结
- 通过RAG式检索注入知识

这与OpenClaw立场**完全一致**：
- ✅ 允许：知识库持续更新（Error Log → AGENTS.md/SKILL.md）
- ❌ 禁止：运行时模型参数修改或目标函数变更

---

## Key Insights for OpenClaw

1. **Error Log作为Experience Bank**: 应结构化存储为(condition, action)对，支持语义检索

2. **SKILL.md三层结构验证**: 
   - Metadata (name/description/version)
   - Workflow (步骤序列)
   - Templates (可复用代码/工具模板)

3. **跨Rollout Critique**: 当前Error Log是单轨迹分析，可扩展为多轨迹对比分析

4. **Task Decomposition检索**: Main Agent委托Sub-agent时，可按子任务分别检索相关Error

5. **多模态预留**: 未来扩展需考虑视觉grounded知识提取

---

## L3 FLAGS

| ID | Flag | Priority |
|----|------|----------|
| #896 | Dual-Stream Knowledge: Experience(战术) + Skill(战略)互补 | P1 |
| #897 | Experience结构化: (condition, action, embedding)三元组 | P2 |
| #898 | Non-Prescriptive注入: 知识作为参考保留即兴空间 | P1 |
| #899 | Cross-Rollout Critique: 多轨迹对比分析提取模式 | P2 |
| #900 | MLLM_kb/exec分离: 知识管理可用更强模型 | P2 |

---

**Relevant to:** Bob (架构验证), tech-lead (Skill/Experience系统设计)

**Paper Link:** https://arxiv.org/abs/2603.12056  
**Code:** https://github.com/XSkill-Agent/XSkill  
**Website:** https://xskill-agent.github.io/xskill_page/
