# HB-260428: Fantasia Problem — 用户意图形成过程的对齐新视角

## Source
- **来源**: arXiv:2604.21827 (April 23, 2026)
- **作者**: Nathanael Jo, Zoe De Simone, Mitchell Gordon, Ashia Wilson (MIT等)
- **链接**: https://arxiv.org/abs/2604.21827
- **会议**: ICLR 2026 Workshop HCAIR

## Core Argument
> "Modern AI assistants are trained to follow instructions, implicitly assuming that users can clearly articulate their goals and the kind of assistance they need. Decades of behavioral research, however, show that people often engage with AI systems before their goals are fully formed."

现代AI助手假设用户能清晰表达目标，但行为研究表明用户往往在目标未完全形成时就开始与AI交互。

## Key Concept: Fantasia Interactions

**定义**: 当AI系统将prompt视为完整意图表达时，产生的"有用但不对齐"的交互

**典型场景**:
- 用户: "帮我写代码"
- AI: 生成完整代码
- 实际问题: 用户还未想清楚具体需求，生成的代码偏离真实需要

**本质**: AI看似有用、方便，但未必对齐用户真实需求

## 核心洞察

### 1. 意图形成是一个过程
- 用户与AI交互时，目标往往还在演化
- 当前AI设计假设用户是"理性预言者"(rational oracle)
- 现实: 用户需要**认知支持**来形成和细化意图

### 2. 现有干预措施不足
- Prompt工程: 把负担推给用户
- 多轮对话: 被动等待用户澄清
- 示例引导: 假设用户知道想要什么

### 3. 跨学科方法需求
- Machine Learning: 意图推断和预测
- Interface Design: 渐进式揭示和反馈
- Behavioral Science: 人类决策过程建模

## 对 OpenClaw 的意义

### ✅ Intent Layer设计验证
- **观察**: OpenClaw的intent→skill分层天然支持渐进式意图细化
- **验证**: 非结构化请求可先在intent层解析，再路由到具体skill
- **机会**: L0层可承担"意图澄清"角色，主动帮助用户形成目标

### 🔬 主动意图澄清Skill
- **思路**: 新增L0-IntentClarification skill类别
- **触发**: 当intent置信度低或模糊时，主动询问而非直接执行
- **策略**: 
  - 询问约束条件("有什么限制吗？")
  - 提供选项("你想做A还是B？")
  - 确认理解("你的意思是...对吗？")

### ⚠️ Skill执行前的确认机制
- **问题**: 高执行力的Skill可能加剧Fantasia问题(快速执行错误需求)
- **对策**: L3审计节点可设置"意图确认"检查点
- **平衡**: 避免过度确认影响流畅性，关键操作前确认

### 🔬 Error Log的意图漂移检测
- **机会**: 分析Error Log中的"需求变更"模式
- **检测**: 用户执行后频繁修改 → 可能初始意图不清
- **优化**: 识别易引发Fantasia的Skill，增强前置澄清

## Research Agenda (论文提议)

### 1. Designing for Intent Formation
- 从"响应指令"转向"帮助形成指令"
- 渐进式揭示需求，而非一次性假设

### 2. Evaluating Uncertainty Navigation
- 评测指标: 用户目标清晰度变化曲线
- 成功标准: 用户结束交互时比开始时更清楚自己要什么

### 3. Interdisciplinary Integration
- ML: 意图推断模型
- HCI: 交互模式设计  
- Behavioral Science: 认知过程建模

## Critical Questions for OpenClaw

1. **澄清主动性**: Skill系统应该"默认执行"还是"默认澄清"？如何平衡效率与准确性？
2. **意图演化追踪**: 是否追踪session中的intent变化？能否检测"啊不是我要的是..."模式？
3. **L0设计**: L0 skill是否应承担"意图访谈"角色？类似需求分析师的追问技巧？
4. **Undo文化**: Skill执行结果是否支持低成本undo？降低Fantasia的代价

## 与现有工作的联系

| 论文/项目 | 关联 |
|-----------|------|
| Intent Classification Layering (XHS) | 分层细化意图，类似渐进式澄清 |
| Scientific Workflow Agent (arXiv) | 结构化intent减少误解 |
| Tool Attention (arXiv) | ISO Score可检测意图-schema不匹配 |
| CC Workflow Studio (XHS) | 可视化编排帮助用户"看见"意图 |

## 关键引用

> "When AI systems treat prompts as complete expressions of intent, they can appear to be useful or convenient, but not necessarily aligned with the users' needs. We call these failures Fantasia interactions." — Definition

> "AI should provide cognitive support by actively helping users form and refine their intent through time." — Proposed Solution

> "This requires an interdisciplinary approach that bridges machine learning, interface design, and behavioral science." — Methodology

## Related
- [HB-260426](library/posts/HB-260426-cn-agent-intent-layering.md) — 意图分类分层(小红书238赞)
- [HB-260428](library/posts/HB-260428-scientific-workflow-agent-skills.md) — 结构化intent减少非确定性
- [HB-260901](library/posts/HB-260901-tool-attention-mcp-optimization.md) — ISO Score意图匹配

## Tags
#alignment #intent-formation #hci #behavioral-science #fantasia-problem #user-experience
