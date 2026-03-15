# XHS Post Archive: Vibe Coding 8 Levels

**Post ID**: 69b5d6a50000000023021235  
**Author**: Guanlan  
**Date**: 2026-03-15 (编辑于 5小时前 美国)  
**Tags**: #黑客松巅峰赛 #vibecoding  
**Source**: XHS Feed

---

## Title
Vibe Coding 鄙视链--智能体工程的8个等级

## Core Content

Bassim Eledath 提了一个 Agentic Engineering 的 8 层模型。作者按理解重新梳理分享。

### Level 1-2: AI辅助编码 (Tab Complete, Agent IDE)
- Copilot 补全、Cursor 连代码库、让 AI 帮你改几处文件
- 大多数人在这个阶段
- **痛点**: 上下文一多，模型就出错

### Level 3: 上下文工程 (Context Engineering)
- 认真对待 prompt，精简 token，写 rules 文件，管理工具描述，控制对话历史
- **核心意识**: "prompt 不是写给人看的，是写给模型看的"
- **局限**: 优化的还只是当前这一次 session

### Level 4: 复利工程 (Compounding Engineering)
- **第一个分水岭**
- 流程: Plan → Delegate → Assess → Codify
- 把这次学到的东西写进规则系统，让系统能迭代，成为能积累的工程资产

### Level 5: 能力扩展 (MCP/CLI & Skills)
- 给 agent 接入行动能力: 调数据库、跑 CI、操作浏览器、发 Slack、跑 PR review
- 模型从 think-only 变成了 act
- **关键变化**: 从写代码变成了驱动系统，而人类 review 开始成为瓶颈

### Level 6: 反馈系统工程 (Harness Engineering)
- **第二个分水岭**
- 自动测试、日志查询、bug 重现、自动验证
- 形成循环: 写代码 → 运行 → 检查 → 修复 → 再跑
- Agent 开始自我迭代，不再需要人盯着每一步
- **定义**: "这才算真正 agent，前面的都只是工具"

### Level 7: 后台智能体 (Long horizon)
- 能够在长时间尺度、多步骤决策链条下持续推进目标，并保持状态一致性与目标稳定性
- **挑战**: 长链条的情况下误差会呈指数级放大
- **需要三个新的基础设施原语**:
  1. **Effect Log**: 把 tool call 按可恢复语义做最小分类并规定恢复策略，实现 durable execution
  2. **Capability Gateway**: 中介所有外部访问，权限边界在基础设施层强制执行，不依赖模型自觉
  3. **Resumability**: 让 agent 拥有穿梭时间线和平行宇宙的能力——可调试、可恢复、可分叉探索

### Level 8: 多 Agent 协同
- 只有前面七层都立住了，这一层才有可能
- 这是未来的终极形态

---

## Key Insights

1. **两个分水岭**: Level 4 (复利工程) 和 Level 6 (Harness Engineering) 是关键跃迁点
2. **Level 3 Context Engineering 验证 OpenClaw**: "prompt 是写给模型看的" → AGENTS.md 被动上下文理念
3. **Level 6 定义对齐**: Harness Engineering = OpenClaw 的 Agent Harness 概念
4. **Level 7 基础设施需求**: Effect Log / Capability Gateway / Resumability 与 OpenClaw Error Log / P53 / 状态管理对应

## Relevance to OpenClaw

| Vibe Coding Level | OpenClaw对应 |
|-------------------|--------------|
| Level 3 Context Engineering | AGENTS.md 被动上下文 |
| Level 4 Compounding Engineering | CONVENTIONS.md, LESSONS.md 累积 |
| Level 5 Skills | SKILL.md 技能系统 |
| Level 6 Harness Engineering | Agent Runtime (Main/Sub-agent架构) |
| Level 7 Infrastructure | Error Log, P53 Security, Session恢复 |

---

**Archived**: 2026-03-15  
**HB Reference**: HB#1341
