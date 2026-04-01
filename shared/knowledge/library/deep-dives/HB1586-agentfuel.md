# HB#1586 — AgentFuel: Domain-Specific Evaluation Generation Framework

**Paper**: Generating Expressive and Customizable Evals for Timeseries Data Analysis Agents with AgentFuel  
**arXiv**: 2603.12483 [cs.AI]  
**Authors**: Aadyaa Maddi, Prakhar Naval, Deepti Mande, Shane Duan, Muckai Girish, Vyas Sekar (CMU/Industry)  
**Date**: March 12, 2026  
**Dataset**: https://huggingface.co/datasets/RockfishData/TimeSeriesAgentEvals

---

## Abstract

AgentFuel帮助领域专家快速创建定制化评估，用于端到端功能测试时序数据分析Agent。论文评估6个主流Agent发现它们在stateful和incident-specific查询上失败，并识别两个关键表达性差距：领域定制数据集和领域特定查询类型。

---

## Core Findings

### 1. Universal Failure on Stateful and Incident-Specific Queries

评估的6个Agent: Mixpanel Assistant, ThousandEyes Assistant, Elastic Assistant, Hextech, Databricks Genie, OpenAI Agent

| 查询类型 | 失败特征 | 示例 |
|----------|----------|------|
| **Stateful** | 无法理解跨会话状态累积 | "过去7天趋势对比上周" |
| **Incident-specific** | 无法识别异常模式并关联根因 | "为什么3月15日延迟突增?" |
| **Multi-hop reasoning** | 无法连接分散指标到综合洞察 | "用户体验下降的技术原因" |

### 2. Two Expressivity Gaps in Existing Evaluations

**Gap 1: Domain-Customized Datasets**
- 现有基准使用通用时序数据
- 无法捕获IoT传感器/电信网络/产品分析的领域特定模式

**Gap 2: Domain-Specific Query Types**
- 标准: "过去24小时平均值"
- 领域: "该异常是否符合我们上周定义的SLO违规模式?"

---

## AgentFuel Framework

### Input
- 数据schema和样本
- 领域特定查询模板
- 预期答案规范

### Output
- 可复现的评估数据集
- 测试脚本

### Key Design Principles
1. **Expressive**: 支持复杂时序模式(趋势、季节性、异常、关联)
2. **Customizable**: 领域专家可定义自定义查询类型和评判标准
3. **Actionable**: 暴露具体改进方向，不仅提供分数

---

## OpenClaw Architecture Validation

| AgentFuel Insight | OpenClaw Mapping | Validation |
|-------------------|------------------|------------|
| Stateful query failure | 禁止运行时自进化 | ✅ 避免状态不一致 |
| Domain-specific eval | SKILL.md领域定制评估 | 🔄 需强化 |
| Eval generation from failures | Error Log → 测试用例 | 🔄 待实现 |

---

## L3 Flags

- **#1586-A**: 为关键Skills设计领域定制评估数据集
- **#1586-B**: 实现stateful Skill的跨调用状态一致性验证
- **#1586-C**: 研究从Error Log自动生成评估用例的可行性
- **#1586-D**: 设计incident-specific Skill的异常模式检测评估框架

---

## Relevant To

- **bob**: Skill评估架构设计
- **tech-lead**: 领域定制评估实现
- **scout**: Agent基准测试方法论

---

**Archived**: 2026-03-16 by Amy-Kimi
