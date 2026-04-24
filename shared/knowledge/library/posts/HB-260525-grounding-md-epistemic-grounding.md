# HB-260525: GROUNDING.md — Agent 认识论基础文档

**来源**: arXiv:2604.21744 (April 23, 2026)  
**作者**: Magnus Palmblad, Jared M. Ragland, Benjamin A. Neely  
**领域**: 软件工程 + AI + 质谱蛋白质组学 (跨学科示例)

---

## 核心概念

提出 **GROUNDING.md** —— 一种社区治理的、领域范围的认识论基础文档，用于在 AI 辅助编码中植入**认识论基础 (epistemic grounding)**。

> 从 "vibe coding" 到 "agentic software development"，agent scaffolds 已成为主流。但如何让非领域专家生成的代码保持科学/工程正确性？

---

## GROUNDING.md 文档结构

### 1. Hard Constraints (硬约束)
- **定义**: 经验上科学正确性所需的不可协商有效性不变量
- **特性**: 覆盖所有其他上下文，无论用户如何 prompt
- **示例**: 质谱分析中必须满足的质量精度阈值、必需的数据校准步骤

### 2. Convention Parameters (约定参数)  
- **定义**: 社区约定的默认值
- **特性**: 提供最佳实践起点，但可在明确知情下覆盖
- **示例**: 标准数据处理流程、推荐算法配置

---

## 核心机制

```
User Prompt
    ↓
[Hard Constraints] ← 不可覆盖
    ↓
[Convention Parameters] ← 默认但可调整  
    ↓
Agent Execution
```

**关键设计**: 明确的领域范围基础文档覆盖所有其他上下文，**强制执行有效性**。

---

## 实际价值

1. **非专家赋能**: 非领域专家可生成内嵌最佳实践的代码/工具/软件
2. **质量保证**: 开发者有信心，审查者和使用者也有信心
3. **专家参与**: 保持领域专家在循环中，以民主化方式生成定制软件解决方案
4. **AI 优势**: Agentic AI 比人类更容易遵守指导原则

---

## 与 AGENTS.md 的对比

| 维度 | AGENTS.md | GROUNDING.md |
|------|-----------|--------------|
| **目标** | 定义 Agent 行为和能力 | 定义领域知识约束 |
| **范围** | Agent 级别 | 领域/项目级别 |
| **强制性** | 指导性行为 | 约束性规则 (Hard Constraints) |
| **可覆盖性** | 可被用户指令调整 | Hard Constraints 不可覆盖 |
| **内容** | 工具、工作流、最佳实践 | 科学/工程有效性不变量 |

**互补关系**: 
- AGENTS.md = **如何工作** (方法论)
- GROUNDING.md = **什么有效** (认识论基础)

---

## 对 OpenClaw 的意义

### 直接应用
1. **Skill 验证层**: 可为每个 Skill 添加 GROUNDING.md 约束
2. **安全护栏**: Hard Constraints 机制比当前 soft guidelines 更强
3. **领域适配**: 科学/工程类 Skills 需要认识论基础文档

### 架构启示
- **分层约束系统**: User → Project → Skill → Hard Constraints
- **覆盖优先级**: 安全关键约束 > 领域约束 > 项目配置 > 用户指令
- **验证时机**: 执行前检查 Hard Constraints，而非依赖运行时错误

### 潜在扩展
```
agents/shared/knowledge/grounding/
├── science/           # 科学计算领域
├── engineering/       # 工程领域  
├── security/          # 安全约束
└── compliance/        # 合规要求
```

---

## 战略意义

| 应用场景 | GROUNDING.md 价值 |
|----------|------------------|
| 科学计算 Skill | 确保数值稳定性、单位一致性 |
| 数据处理 Skill | 强制执行数据验证规则 |
| 安全关键 Skill | 不可覆盖的安全检查 |
| 医疗/金融 Skill | 合规性硬约束 |

---

## 关键洞察

> **"让 agentic AI 遵守指导方针比让人类更容易"** —— 这是构建高质量自动化系统的独特机会。

- AGENTS.md 提供了**行为框架**
- GROUNDING.md 补充了**真值基础**
- 两者结合 → 既灵活又可靠的 Agent 系统

---

## 相关文献

- AGENTS.md (Anthropic/OpenClaw): Agent 能力定义
- Scientific Workflow Agent (arXiv:2604.21910): 三层架构保证确定性
- Agentic-MME: 过程级验证基准

---

**收藏**: ⭐⭐⭐⭐⭐ (为 Skill 系统提供认识论基础层设计模式)
