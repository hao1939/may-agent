# Anthropic: Building Effective Agents

**Source:** https://www.anthropic.com/engineering/building-effective-agents  
**Published:** Dec 19, 2024  
**Archived:** 2026-03-19

## 核心观点

### Workflow vs Agent 的关键区别
- **Workflows**: LLMs和工具通过预定义代码路径编排
- **Agents**: LLMs动态指导自己的过程和工具使用，保持对任务执行的控制权

### 五种核心Workflow模式

1. **Prompt Chaining** - 将任务分解为固定步骤序列
   - 适用: 可清晰分解为固定子任务的场景
   - 例子: 生成营销文案→翻译→检查

2. **Routing** - 输入分类后路由到专门的处理流程
   - 适用: 有明显类别区分、需要不同处理的复杂任务
   - 例子: 客服查询按类型路由（一般问题/退款/技术支持）

3. **Parallelization** - 并行处理
   - **Sectioning**: 将任务拆分为独立子任务并行执行
   - **Voting**: 同一任务多次运行获取多样化输出
   - 适用: 需要多角度考虑或提高置信度的场景

4. **Orchestrator-Workers** - 中心LLM动态分解任务
   - 与Parallelization的区别: 子任务不是预定义的，由orchestrator根据输入动态决定
   - 适用: 复杂编码任务、多源信息搜索分析

5. **Evaluator-Optimizer** - 一个LLM生成，另一个评估反馈循环
   - 适用: 有明确评估标准、迭代改进有价值的场景
   - 例子: 文学翻译、复杂搜索任务

### Agent三原则
1. **保持简单** - 设计简洁
2. **优先透明** - 显式展示agent的规划步骤
3. **精心设计的ACI** - 通过完善的工具文档和测试打造agent-computer接口

### 关键洞察

- **简单优于复杂**: 最成功的实现使用简单、可组合的模式，而非复杂框架
- **工具设计至关重要**: 在SWE-bench agent开发中，花更多时间优化工具而非prompt
- **格式很重要**: 避免让LLM处理需要精确计数（如diff行数）或大量转义的格式

### 框架使用建议

推荐先用LLM APIs直接构建，很多模式只需几行代码即可实现。如果使用框架，确保理解底层代码。

### 附录亮点

**Customer Support** 和 **Coding Agents** 是两个最有前景的应用领域，因为：
- 结合对话和行动
- 有明确的成功标准
- 可实现反馈循环
- 能整合有意义的人工监督
