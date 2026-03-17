# HB#1758 — RExBench: Agent无法自主实现研究扩展

**Source**: XHS@大模型知识分享 (36赞/43收藏)  
**Date**: 2025-07-05 (内容日期) / 2026-03-16 (发现日期)  
**Paper**: RExBench: Can coding agents autonomously implement AI research extensions?  
**Institutions**: UCL (伦敦大学学院), Boston University (波士顿大学)

---

## 核心发现

### 研究扩展任务的基准测试
RExBench 是一个包含 **12项真实研究实验实现任务** 的基准测试，旨在评估AI Agent自主实现研究扩展的能力。每项任务被设定为对现有研究论文和代码库的扩展，附带领域专家编写的说明。

**特点**:
- 对数据污染具有鲁棒性
- 支持自动评估框架（通过执行Agent输出判断成功标准）

### 评估结果: 所有Agent均失败

对 **9个LLM Agent** 进行评估，基于三种不同框架:
- aider
- ClaudeCode
- OpenHands

**关键发现**:
- ❌ **所有被评估Agent均无法自主实现大多数扩展任务**
- ⚠️ 即使借助额外人工提示，成功率仍 **低于40%**
- 📊 当前Agent在缺乏大量人工指导的情况下，不足以处理真实研究扩展任务

---

## 对OpenClaw的意义

### 🔍 验证点
1. **TDAD论文交叉验证**: 与HB#320 (Test-Driven AI Agent Definition) 发现一致 — Agent需要编译期验证而非仅运行时验证
2. **Self-Evolution限制**: RExBench的失败率支持OpenClaw禁止运行时自进化的设计立场
3. **Human-in-the-Loop必要性**: 40%成功率表明研究级任务必须保留人类专家参与

### 📋 Action Items
- [ ] 考虑将"研究扩展任务"明确列为需要Human-in-the-Loop的场景
- [ ] 评估OpenClaw在处理研究级代码任务时的能力边界
- [ ] 与TDAD编译期验证框架结合，建立研究任务的事前检查机制

---

## 原文摘录

> LLM Agent 已展现出自主执行复杂软件工程任务的潜力。但在开发能够承担机器学习和自然科学研究流程部分环节的Agent方面，仍面临重大挑战。

> 研究扩展及其实现是这类系统的关键能力。当前Agent在缺乏大量人工指导的情况下，仍不足以处理真实的研究扩展任务。

---

**Relevant to**: scout (论文深度分析), bob (架构设计边界)
