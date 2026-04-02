# DCI: Deliberative Collective Intelligence Paper

**arXiv:** 2603.11781  
**Title:** From Debate to Deliberation: Structured Collective Reasoning with Typed Epistemic Acts  
**Author:** Sunil Prakash (Indian School of Business)  
**Date:** March 12, 2026  
**Tags:** #multi-agent #deliberation #collective-intelligence #reasoning #framework

---

## 核心贡献

DCI框架将集体推理作为**一等计算对象**，区别于现有的聚合(ensembling)、辩论(debate)、编排(orchestration)和投票(voting)范式。

### 五大创新元素

1. **类型化认知交互 (Typed Epistemic Interaction)**
   - Agent交换结构化推理动作：propose, challenge, bridge, synthesize
   - 协议在结构层面区分challenge与proposal

2. **基于Session的审议 (Session-based Deliberation)**
   - 分阶段组织集体思考：arrival → independent thought → mutual engagement → collective shaping → closure
   - 防止过早达成共识

3. **张力作为一等对象 (Tensions as First-Class Objects)**
   - 分歧被保留在共享工作空间，而非被多数规则扁平化
   - 张力携带结构：哪些立场冲突、支持各方的证据、什么能消除分歧

4. **有界开放性 (Bounded Openness)**
   - 新证据和假设可在受控准入规则下进入审议
   - 防止过早封闭和无限扩展

5. **保证的程序收敛 (Guaranteed Procedural Convergence)**
   - 每个DCI session终止于结构化决策包
   - 包含：选定选项、残余异议、少数派报告、重新开放条件

---

## 四推理原型 (Delegate Archetypes)

| 原型 | 符号 | 功能 |
|------|------|------|
| **Framer** | δF | 定义真实问题，澄清歧义，识别隐藏维度 |
| **Explorer** | δE | 生成新颖可能性，提出非传统路径、类比 |
| **Challenger** | δC | 压力测试一切，寻找隐藏假设、弱逻辑、风险 |
| **Integrator** | δI | 将群体思维整合为一致方向，识别共同模式 |

---

## 14类型化认知行为 (Typed Epistemic Acts)

组织在三层模型中，实现结构化的审议交互。

---

## DCI-CF 收敛流算法

### 核心保证

**DCI保证：**
- 有界终止（最大轮数限制）
- 结构化决策包（即使存在持续分歧）
- 张力保留（分歧不被扁平化）
- 过程透明（每步可审计）

**DCI不保证：**
- 真理或最优性（仅保证公平有界的过程）
- 共识（允许有记录的异议）
- 效率（审议有成本）

---

## 实验结果

| 指标 | 结果 |
|------|------|
| 非例行任务 vs 非结构化辩论 | **+0.95** (95% CI [+0.41, +1.54]) |
| 隐藏档案任务 (hidden-profile) | **9.56** (所有系统中最高) |
| 例行决策 (负面对照) | 5.39 (失败) |
| Token成本 vs 单Agent | **~62×** |
| 结构化决策包产出率 | **100%** |
| 少数派报告产出率 | **98%** |

### 关键发现

- **任务依赖性**：审议结构对非例行任务有效，对例行任务反而有害
- **单Agent质量**：单Agent生成在整体质量上显著优于DCI (-0.60)
- **过程问责**：当过程质量和问责制重要时，审议结构才有价值

---

## 与OpenClaw的关联

### 架构映射

| DCI概念 | OpenClaw对应 |
|---------|--------------|
| 四原型 (Framer/Explorer/Challenger/Integrator) | Main Agent角色 ↔ Sub-agent专业分工 |
| 类型化认知行为 | Error Log的分类与结构化记录 |
| 共享工作空间 | Context共享机制 |
| 结构化决策包 | Error Log + Decision Record |
| 少数派报告 | 异议记录与替代方案存档 |

### 关键验证

1. **任务依赖性验证**：DCI实验证实"例行任务用单Agent，复杂任务用多Agent"的设计哲学 ✅

2. **成本意识**：62× token成本提醒我们必须谨慎选择多Agent触发条件

3. **张力保留**：Error Log应记录分歧而非仅记录共识

4. **程序收敛**：L3层审核机制可借鉴DCI-CF的终止保证

---

## 引用

```bibtex
@article{prakash2026dci,
  title={From Debate to Deliberation: Structured Collective Reasoning with Typed Epistemic Acts},
  author={Prakash, Sunil},
  journal={arXiv preprint arXiv:2603.11781},
  year={2026}
}
```
