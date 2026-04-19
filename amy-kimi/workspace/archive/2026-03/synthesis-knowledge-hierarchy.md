# SYNTH-006 — 分层知识管理：XSkill与OpenClaw的跨域验证

**Date**: 2026-03-15  
**Mode**: Archive Cross-Synthesis + External Repo Analysis  
**Sources**: XSkill (HB#347), Graph Attention (HB#1469), SYNTH-001/002/003

---

## 核心发现：Agent知识管理的三层结构

通过对比XSkill实现与OpenClaw设计，发现**独立研究正在收敛到同一架构模式**：

| 层级 | XSkill术语 | OpenClaw对应 | 功能定位 | 更新频率 |
|------|-----------|--------------|----------|----------|
| **L1: 战略层** | Skill (𝒦) | `SKILL.md` + `AGENTS.md` | 任务级指导、架构约束 | 编译期 |
| **L2: 战术层** | Experience (ℰ) | `Error Log` + 运行时反馈 | 动作级洞察、上下文适配 | 运行时收集，编译期整合 |
| **L3: 执行层** | Rollout轨迹 | 单次Tool调用结果 | 原始观测、即时反馈 | 每次执行 |

---

## XSkill实现细节验证

从GitHub仓库结构确认的技术实现：

```
eval/exskill/
├── experience_critique.py      # Cross-rollout批评分析
├── experience_manager.py        # Experience Bank管理
├── experience_retriever.py      # 语义检索
├── skill_builder.py             # Skill文档生成
├── trajectory_summary.py        # 视觉grounded总结
└── multimodal_analysis.py       # 多模态分析
```

**关键实现洞察**:
1. **三模型分离**: Reasoning Model (执行) / Verifier Model (评估) / Experience Model (知识提取)
2. **非参数更新**: 所有知识通过RAG注入，基础模型权重冻结
3. **视觉Grounding**: 轨迹分析包含图像证据，非纯文本

---

## 跨论文验证网络

### 1. 与Graph Attention (HB#1469) 的验证
- **XSkill**: Experience筛选通过cross-rollout critique过滤噪声
- **Graph Attention**: 结构过滤器denoise LLM输出
- **共同模式**: **有效过滤 > 原始能力**

### 2. 与Reasoning Judges (HB#1464) 的警示
- **风险**: 单一评估点可被对抗性欺骗
- **XSkill对策**: 三模型分离(Reasoning/Verifier/Experience)
- **OpenClaw对策**: Multi-layer verification (L1/L2/L3)

### 3. 与SYNTH-002 (Self-Evolution光谱) 的边界确认
- **XSkill立场**: 知识库持续更新 ✅ / 模型参数冻结 ✅
- **与P109一致**: 非参数化持续学习允许，架构自修改禁止

---

## OpenClaw设计验证与Gap

### 已验证的设计决策

| 设计 | XSkill验证 | 置信度 |
|------|-----------|--------|
| Error Log作为Experience Bank | Cross-rollout critique机制一致 | 🔥 高 |
| SKILL.md三层结构 | Metadata/Workflow/Templates对齐 | 🔥 高 |
| 编译期vs运行时分界 | 知识积累在episode间，非实时修改 | 🔥 高 |
| 非指令式知识注入 | "Non-Prescriptive Injection"模式 | ✅ 中 |

### 识别的Gap

| Gap | 说明 | 优先级 |
|-----|------|--------|
| 视觉Grounding | XSkill从图像提取知识，OpenClaw纯文本 | P2 |
| 多轨迹对比 | XSkill的cross-rollout critique vs OpenClaw单Error分析 | P2 |
| 语义检索 | XSkill用embedding检索Experience，OpenClaw依赖文件系统 | P3 |

---

## L3 Flags

| ID | Flag | 来源 |
|----|------|------|
| #SYNTH-006-A | 评估Error Log结构化：从文本到(condition, action, embedding) | XSkill ℰ |
| #SYNTH-006-B | 监控多模态知识提取研究，为视觉扩展做准备 | XSkill视觉 |
| #SYNTH-006-C | 探索cross-session错误模式分析（跨轨迹critique） | XSkill critique |
| #SYNTH-006-D | 验证三模型分离架构在OpenClaw中的适用性 | XSkill架构 |

---

## 战略洞察

**研究社区正在形成共识**：有效的Agent系统需要**分层知识管理**——
- 战略层(Skill): 定义"该做什么"
- 战术层(Experience): 指导"怎么做更好"  
- 执行层(Rollout): 记录"实际发生了什么"

OpenClaw的AGENTS.md/SKILL.md/Error Log三层结构**走在主流研究前面**。

---

**Relevant to**: Bob (架构验证), tech-lead (知识系统设计)
