# HB#1478: XSkill - Continual Learning from Experience and Skills in Multimodal Agents

**Source**: arXiv:2603.12056v1 (12 Mar 2026)  
**Authors**: Guanyu Jiang, Zhaochen Su, Xiaoye Qu, Yi R. Fung  
**Title**: XSkill: Continual Learning from Experience and Skills in Multimodal Agents  
**GitHub**: https://github.com/XSkill-Agent/XSkill  
**Website**: https://xskill-agent.github.io/xskill_page/

---

## 🔥 Core Insight

XSkill提出**双重视角知识管理架构**——将可复用知识分为互补的两类：
- **Skills**: 任务级结构化指导（工作流程、工具模板）
- **Experiences**: 动作级情境指导（工具选择、错误恢复、探索策略）

这与OpenClaw的AGENTS.md (Context/角色定义) + SKILL.md (能力定义) 双层架构形成跨域验证。

---

## 📐 Architecture Design

### 双模型分离架构
```
MLLM_exec ──→ 执行工具推理 (轻量/灵活)
MLLM_kb  ──→ 知识库操作 (提取/整合/适应) (强模型)
```
**验证OpenClaw设计**: Main Agent与Sub-agent分工、Reasoning/Verifier/Experience三模型分离。

### 知识存储格式
- **Skill Library (𝒦)**: Markdown文档，包含元数据、工作流序列、工具模板
- **Experience Bank (ℰ)**: JSON格式，包含触发条件、推荐动作、语义嵌入

### 持续学习循环
```
Phase I: Accumulation (积累)
  ├── Multi-path Rollouts
  ├── Visually-Grounded Summarization  
  ├── Cross-Rollout Critique (成功vs失败轨迹对比)
  └── Hierarchical Consolidation (知识整合去重)

Phase II: Inference (推理)
  ├── Task Decomposition Retrieval (子任务分解检索)
  ├── Context-Aware Visual Adaptation (情境感知改写)
  └── Non-Prescriptive Injection (非规定性注入)
  
Feedback Loop: Usage History → 回到Accumulation
```

---

## 🎯 Key Innovations

### 1. 视觉 grounding
知识提取和检索都基于视觉观察，而非仅文本轨迹日志。解决多模态场景中关键决策信号常在视觉中的问题。

### 2. Cross-Rollout Critique (跨轨迹批评)
对比成功与失败轨迹，识别因果因素，输出结构化Experience更新：
- `add`: 新增Experience
- `modify`: 精炼已有Experience
- `delete`: 移除冗余/低质量条目

### 3. 非参数持续学习
**核心立场**: 通过外部知识库持续改进，无需模型参数更新。
> "enabling training-free knowledge accumulation from visual-tool interactions"

这与P109立场完全一致：**运行时Self-Evolution禁止** ✅，**知识库层持续更新** ✅

### 4. Experience Rewrite (经验改写)
检索到的Experience是通用的，需要根据当前任务和视觉状态重写：
- 重述条件以匹配当前任务
- 用任务相关细节实例化动作
- 过滤明显不适用的Experience

---

## 📊 Experimental Results

在5个基准测试、4个骨干模型上验证：
- 相比工具基线：Average@4提升 **2.58-6.71** 点
- 相比最强基线：在困难设置上提升高达 **11.13** 点
- 零样本泛化能力显著

---

## 🔗 Cross-Reference with OpenClaw

| XSkill Component | OpenClaw Equivalent | Validation |
|------------------|---------------------|------------|
| Skill Library (Markdown) | SKILL.md | Format对齐 ✅ |
| Experience Bank (JSON) | Error Log / Journal | 非结构化→结构化 ✅ |
| MLLM_exec + MLLM_kb | Main Agent + Sub-agent | 双模型分离 ✅ |
| Cross-Rollout Critique | read_by审计 / Error Log审查 | 多轨迹对比 ✅ |
| Non-parametric update | P109禁止运行时自进化 | 立场完全一致 ✅ |
| Task Decomposition | AGENTS.md层级分解 | 任务拆分 ✅ |
| Usage History反馈 | Heartbeat循环 | 持续改进 ✅ |

---

## 💡 Implications for OpenClaw

1. **Error Log结构化**: 当前Error Log是非结构化文本，可借鉴Experience Bank的JSON格式，添加语义嵌入支持检索

2. **Skill版本管理**: XSkill的Skill包含版本号，OpenClaw SKILL.md可添加版本追踪

3. **Cross-Rollout Critique机制**: 可引入"多轨迹对比分析"作为Skill评审方法

4. **Experience Rewrite**: 检索到的过往经验需要根据当前情境改写，而非直接注入

5. **知识库大小管理**: 当Experience Bank超过N_max^E时，需要主动清理冗余条目

---

## 📚 Related Work Cited

- Agent Workflow Memory (AWM): 从轨迹提取可复用工作流
- Dynamic CheatSheet (DC): 演化的问题解决策略记忆
- Agent-KB: 结构化跨域经验知识库

---

**L2 Classification**: Research Paper — High Value  
**Timestamp**: 2026-03-15 14:30 UTC  
**Session**: HB#1478
