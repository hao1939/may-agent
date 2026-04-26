# HB-260946: Agentic AI for Science Automation — 三层架构的科学工作流自动化

**Source**: arXiv:2604.21910  
**Title**: From Research Question to Scientific Workflow: Leveraging Agentic AI for Science Automation  
**Authors**: Bartosz Balis, Michal Orzechowski, Piotr Kica, Michal Dygas, Michal Kuszewski  
**Date**: 2026-04-23

---

## 核心问题

科学工作流系统自动化了执行（调度、容错、资源管理），但未自动化**语义转换**——科学家仍需手动将研究问题转换为工作流规范。这需要领域知识和基础设施专业知识的结合。

---

## 解决方案: 三层Agentic架构

### Layer 1: Semantic Layer (语义层)
- **LLM解释自然语言** → 结构化意图(structured intents)
- 非确定性限制在此层

### Layer 2: Deterministic Layer (确定性层)
- **验证生成器**产生可复现的工作流DAG
- 相同意图 → 相同工作流（确定性保证）

### Layer 3: Knowledge Layer (知识层)
- 领域专家编写 **"Skills"**（markdown文档）
- 编码: 词汇映射、参数约束、优化策略

---

## 关键技术洞察

| 设计决策 | 效果 |
|---------|------|
| LLM非确定性限制在意图提取 | 下游确定性保证 |
| Skills驱动延迟工作流生成 | **数据传输 -92%** |
| 验证生成器 | 工作流可复现性 |

**消融实验结果** (150 queries):
- 无Skills: 意图完全匹配准确率 44%
- 有Skills: 意图完全匹配准确率 **83%**

---

## 性能指标

基于1000 Genomes群体遗传学工作流 + Hyperflow WMS + Kubernetes:

- LLM开销: < 15秒/查询
- 成本: < $0.001/查询
- 数据传输: 减少92%

---

## 对OpenClaw的意义

### 🔴 高优先级

1. **Skills作为知识层**
   - 我们已有SKILL.md，但可强化其"知识层"定位
   - 明确分离: 意图提取(LLM) vs 执行逻辑(Skills)

2. **确定性执行保证**
   - 相同AGENTS.md + 相同意图 = 相同执行路径
   - 当前系统是否满足？需要验证

### 🟡 中等优先级

3. **延迟生成模式**
   - 论文的deferred workflow generation类似我们的动态规划
   - 可减少前期数据传输

4. **分层责任明确**
   - L0-L2分层可与论文三层架构对照
   - L0=Semantic, L1=Deterministic DAG, L2=Skill execution?

---

## 架构对比

| 组件 | 论文架构 | OpenClaw映射 |
|------|---------|-------------|
| Semantic Layer | LLM意图提取 | L0 Planning |
| Deterministic Layer | 验证DAG生成 | L1 Reasoning? |
| Knowledge Layer | Skills (markdown) | SKILL.md |
| Execution | Hyperflow WMS | Session执行层 |

**开放问题**: 我们的L1-L2边界是否足够清晰？

---

## 相关链接

- Paper: https://arxiv.org/abs/2604.21910
- 同主题: HB-260942 (DIVERT - 类似的分层评估思想)

---

**标签**: #scientific-workflow #agent-architecture #skills #knowledge-layer #determinism
