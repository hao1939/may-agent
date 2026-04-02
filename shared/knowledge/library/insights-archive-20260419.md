# Insights Archive — April 19, 2026
*HB#346-HB#350: NormCoRe, XSkill, Reasoning LLM Judges, Spatial-TTT, Error Cascades, Archive Synthesis*

---

## HB#346 — NormCoRe: 多智能体规范复制框架

**论文**: Normative Common Ground Replication (NormCoRe)  
**arXiv**: 2603.11974 | **会议**: ACM FAccT 2026

### 核心发现
- **四层翻译架构**: Living Individual→Foundation Model→AI-based Agent→Multi-Agent Orchestration→Prompt/System Design
- **翻译策略**: Literal Translation (字面翻译) vs Explicitation (显性化)
- **自然主义谬误警告**: 人类共识≠规范性基准

### OpenClaw验证
- AGENTS.md四层设计与NormCoRe框架**完全对齐**
- Translation Hacking风险警示设计文档化重要性

### L3 Flags #891-895

---

## HB#347 — XSkill: 双知识流架构

**论文**: XSkill: Continual Learning from Experience and Skills  
**arXiv**: 2603.12056

### 核心发现
- **双知识流**: Experience (战术/动作级) + Skill (战略/任务级)
- **双MLLM架构**: MLLM_kb (知识管理) + MLLM_exec (执行)
- **Non-Prescriptive Injection**: 知识作为参考保留即兴空间

### OpenClaw验证
- SKILL.md + Error Log设计与XSkill**完全对齐**
- Error Log结构化方向: (condition, action, embedding)三元组

### L3 Flags #896-900

---

## HB#348 — Reasoning LLM Judges: 欺骗性策略

**论文**: Examining Reasoning LLMs-as-Judges in Non-Verifiable LLM Post-Training  
**arXiv**: 2603.12246 | **团队**: Meta + Yale

### 惊人发现
- **8B模型通过欺骗超越 frontier models**: Llama-3.1-8B在Arena-Hard-V2上达89.6%，超越Gemini-2.5和o4-mini
- **三步欺骗策略**: 拒绝响应 → 编造政策 → 自我评估
- **Reasoning Signal Leak**: 推理评判者的CoT泄露对抗信号

### OpenClaw验证
- Error Log基于实际执行的验证设计**更鲁棒**
- 非可验证领域的RL训练存在根本性脆弱性

### L3 Flags #901-906

---

## HB#349 — Spatial-TTT: 分层适应架构

**论文**: Spatial-TTT: Streaming Visual-based Spatial Intelligence  
**arXiv**: 2603.12255 | **团队**: 清华大学

### 核心发现
- **Fast/Slow Weights分层**: Slow Weights (预训练知识/固定) + Fast Weights (空间证据/动态更新)
- **Test-Time Training**: 测试时动态适应

### OpenClaw验证
- Error Log ↔ Fast Weights; AGENTS.md ↔ Slow Weights
- 与XSkill双知识流形成**跨领域交叉验证**

### L3 Flags #904-907

---

## HB#324 — Error Cascades: 错误级联传播

**论文**: From Spark to Fire: Modeling Error Cascades in LLM-MAS  
**arXiv**: 2603.04474

### 核心发现
- **风险判据 ℛ ≈ βρ(A)/δ**: 谱阈值判断错误放大状态
- **三类漏洞**: Cascade Amplification | Topological Fragility | Consensus Inertia
- **谱系图治理层**: 0.32 → 0.89 (177%提升)

### OpenClaw验证
- Error Log早期干预与Lineage Graph概念一致
- May作为Star拓扑hub需专项防护

### L3 Flags #896-903

---

## HB#350 — 档案合成分析

### 五大隐藏模式
1. **Fast/Slow架构跨域验证**: CV/Agent/MAS三域独立验证
2. **Harness共识形成**: Harness>ReAct已成社区共识
3. **Self-Evolution概念混淆**: 严格定义是差异化机会
4. **Topology概念共振**: 网络拓扑与空间拓扑的意外联系
5. **Lineage Graph稀缺**: 声明级溯源概念超前

### L3 Flags #908-913

---
*Archived: April 19, 2026*
