# Anthropic: Building Effective Agents (官方实践指南)

**Source:** Anthropic Engineering Blog  
**Date:** December 19, 2024  
**Discovery Date:** 2026-04-02  
**Researcher:** Amy-Kimi

---

## 核心发现

Anthropic发布的这篇指南是Agent Harness领域的奠基性文档，明确定义了Workflow与Agent的架构区别，并提出了5种可组合的生产级模式。

---

## 关键概念：Workflow vs Agent

| 类型 | 定义 | 适用场景 |
|------|------|----------|
| **Workflow** | LLM和工具通过预定义代码路径编排 | 任务明确、需要一致性和可预测性 |
| **Agent** | LLM动态指导自身过程和工具使用，保持对任务执行的控制权 | 需要灵活性和模型驱动决策的开放性问题 |

---

## 五大工作流模式 (Production Patterns)

### 1. Prompt Chaining (提示链)
将任务分解为一系列步骤，每个LLM调用处理前一个输出。
- **适用**: 可清晰分解为固定子任务的场景
- **权衡**: 用延迟换取更高准确性
- **示例**: 生成营销文案→翻译成其他语言；写大纲→检查→基于大纲写文档

### 2. Routing (路由)
对输入进行分类并导向专门的后续任务。
- **适用**: 复杂任务中有不同类别需要分别处理
- **示例**: 客服查询分类(一般问题/退款/技术支持)→不同下游流程

### 3. Parallelization (并行化)
两种变体：
- **Sectioning**: 将任务拆分为独立子任务并行运行
- **Voting**: 同一任务运行多次获取多样化输出
- **适用**: 可并行提速，或需要多视角/多次尝试提高置信度
- **示例**: 安全审核(一个模型处理查询，另一个筛查不当内容)；代码漏洞审查(多个提示分别检查)

### 4. Orchestrator-Workers (编排器-工作者)
中央LLM动态分解任务，委派给工作者LLM，并综合结果。
- **与并行化的区别**: 子任务不是预定义的，由编排器根据具体输入动态决定
- **适用**: 无法预测所需子任务的复杂任务(如编码涉及多文件修改)

### 5. Evaluator-Optimizer (评估器-优化器)
一个LLM生成响应，另一个在循环中提供评估和反馈。
- **适用**: 有明确评估标准，迭代改进可产生可衡量价值
- **关键信号**: (1)人类反馈能 demonstrably 改进LLM响应；(2)LLM能提供此类反馈
- **示例**: 文学翻译(评估器捕捉译者可能遗漏的细微差别)；复杂搜索(评估器决定是否需要进一步搜索)

---

## Agent的核心特征

Agent在以下关键能力成熟时开始投入生产：
- 理解复杂输入
- 推理和规划
- 可靠使用工具
- 从错误中恢复

**执行流程**:
1. 从人类用户接收命令或交互讨论
2. 任务清晰后，Agent独立规划和操作
3. 每一步从环境获取"ground truth"(工具调用结果或代码执行)
4. 可在检查点或遇到障碍时暂停获取人类反馈
5. 任务完成或达到停止条件(如最大迭代次数)时终止

**实现本质**: 通常只是基于环境反馈循环使用工具的LLM

---

## 核心原则

1. **保持简单**: 在agent设计中维持简洁
2. **优先考虑透明性**: 明确展示agent的规划步骤
3. **精心设计ACI (Agent-Computer Interface)**: 通过彻底的工具文档和测试

---

## 关键建议

> "Success in the LLM space isn't about building the most sophisticated system. It's about building the right system for your needs."

- 从简单提示开始
- 用全面评估优化
- 仅当简单方案不足时才添加多步agentic系统
- 框架可帮助快速开始，但不要犹豫在生产中减少抽象层，用基础组件构建

---

## 对我们的系统的意义

1. **验证我们的分层架构**: Workflow vs Agent的区分与我们Skill(确定性)和Agent(自主性)的分层一致
2. **可组合模式库**: 5种模式可作为我们编排层的参考实现
3. **ACI设计**: 工具文档和测试的重要性强调了我们需要完善的Tool Registry
4. **渐进复杂性**: 从简单开始、按需添加复杂性的原则与我们"简单优先"理念一致

---

## 参考链接
- 原文: https://www.anthropic.com/engineering/building-effective-agents
- Cookbook: https://platform.claude.com/cookbook/patterns-agents-basic-workflows
