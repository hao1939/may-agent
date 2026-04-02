# Anthropic "Building Effective Agents" 深度解析

**Source**: https://www.anthropic.com/engineering/building-effective-agents  
**Date**: Dec 19, 2024 (scraped 2026-04-02)  
**Authors**: Erik Schluntz, Barry Zhang  
**Status**: ✅ Core Reference Architecture

---

## 核心观点

> "最成功的实现不是使用复杂的框架或专门的库，而是使用简单、可组合的模式。"

Anthropic在与数十个跨行业团队合作构建LLM Agent后，总结出生产环境的最佳实践。

---

## 关键架构区分: Workflows vs Agents

| 维度 | Workflows | Agents |
|------|-----------|--------|
| **控制方式** | 预定义代码路径 | LLM动态 directing |
| **灵活性** | 低 - 固定子任务 | 高 - 自主决策 |
| **适用场景** | 任务明确、流程固定 | 开放性问题、步骤不可预测 |
| **成本/延迟** | 低 | 高 |
| **错误累积** | 可控 | 可能 compound |

---

## 5大生产级Workflow模式

### 1. Prompt Chaining (提示链)
```
任务分解 → LLM Call 1 → [检查点] → LLM Call 2 → ...
```
- **适用**: 可干净分解为固定子任务
- **目标**: 用延迟换取更高准确性
- **示例**: 生成营销文案 → 翻译 → 质量检查

### 2. Routing (路由)
```
输入 → 分类器 → 专用下游流程
```
- **适用**: 复杂任务有明显类别区分
- **优势**: 分离关注点，专用提示优化
- **示例**: 客服查询路由到不同处理流程

### 3. Parallelization (并行化)
**Sectioning变体**: 任务分解为独立子任务并行运行  
**Voting变体**: 同一任务多次运行获取多样化输出

- **适用**: 可并行化的子任务 / 需要多视角验证
- **示例**: 代码安全审查由多个独立提示分别审查

### 4. Orchestrator-Workers (编排器-工作者)
```
Orchestrator LLM 动态分解任务 → 委派 Worker LLMs → 合成结果
```

- **适用**: 子任务数量和性质无法预测
- **关键区别**: 与Parallelization拓扑相似，但子任务**动态确定**
- **示例**: 需要修改多个文件的复杂代码变更

### 5. Evaluator-Optimizer (评估器-优化器)
```
LLM生成 → LLM评估反馈 → 循环迭代
```

- **适用**: 有明确评估标准，迭代优化有价值
- **两个判断标志**:
  1. 人类反馈能 demonstrably 改善LLM响应
  2. LLM能提供此类反馈

---

## Agent构建三原则

### 1. 保持简单 (Maintain simplicity)
- 从简单提示开始
- 用全面评估优化
- 仅在简单方案不足时增加多步骤系统

### 2. 优先考虑透明性 (Prioritize transparency)
- 显式展示Agent的规划步骤
- 让用户理解Agent正在做什么

### 3. 精心设计ACI (Agent-Computer Interface)
- 彻底的工具文档和测试
- **投资ACI的工作量应相当于投资HCI**

---

## Tool设计的黄金法则

### 格式选择建议
1. **给模型足够token** "思考"，避免把自己逼入角落
2. **保持格式接近** 模型在互联网上自然见过的文本
3. **消除格式开销** - 避免需要精确计算行数或大量转义

### Tool-First设计哲学
> "在构建SWE-bench Agent时，我们实际上花在优化工具上的时间比整体提示更多。"

**关键洞察**: 工具定义的质量比Prompt工程更重要。

**案例**: 发现模型在使用相对路径时容易出错 → 改为**强制要求绝对路径** → 问题彻底解决

---

## 框架建议

### 推荐框架
- Claude Agent SDK
- Strands Agents SDK (AWS)
- Rivet (GUI workflow builder)
- Vellum (GUI workflow builder)

### 警告
> "框架通过简化标准低级任务（调用LLM、定义解析工具、链式调用）让入门更容易。但它们常创造额外抽象层，可能掩盖底层提示和响应，使调试更困难。"

**建议**: 先用LLM API直接构建；如果使用框架，确保理解底层代码。

---

## 两个高价值应用领域

### A. 客户支持
- 自然对话流 + 外部工具集成
- 成功可明确定义（问题解决）
- 使用场景：多家公司采用按成功解决收费模式

### B. 编程Agent
- 代码解决方案可通过自动化测试验证
- Agent可用测试结果作为反馈迭代
- Anthropic实现：在SWE-bench Verified上解决真实GitHub issue

---

## 对我们系统的意义

### 🎯 直接适用的设计决策

| 我们的设计 | Anthropic建议 | 对齐度 |
|-----------|--------------|--------|
| ReAct + Middleware | Workflow基础模式 | ✅ 一致 |
| Tool-first设计 | Tool定义优先于Prompt | ✅ 一致 |
| 文件系统通信 | Filesystem-as-Protocol | ✅ 一致 |
| Skill系统 | 工具生态 | ✅ 一致 |

### 🔧 待优化的具体点

1. **绝对路径强制**: 当前实现可能使用相对路径，应改为强制绝对路径
2. **工具文档**: 投资更多精力在工具描述的清晰度
3. **评估器模式**: 考虑在代码生成流程中加入Evaluator-Optimizer循环
4. **并行化**: 评估哪些子任务可以并行执行

### ⚠️ 避免的陷阱

- 过早引入多Agent复杂性
- 在简单方案足够时追求复杂架构
- 忽视工具接口设计的重要性

---

## 相关资源

- 原文: https://www.anthropic.com/engineering/building-effective-agents
- Cookbook: https://platform.claude.com/cookbook/patterns-agents-basic-workflows
- SWE-bench实现: https://www.anthropic.com/research/swe-bench-sonnet

---

*This is a canonical reference for production agent architecture. Recommend quarterly re-review.*
