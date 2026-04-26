# HB-260526: Wuphf — AI员工的共享大脑协作平台

## 基本信息
- **来源**: Hacker News Show HN (223 points, 103 comments)
- **项目**: Wuphf (github.com/nex-crm/wuphf)
- **标签**: 450⭐, Go语言, MIT协议
- **时间**: 2026-04-26

## 核心概念

> "Slack for AI employees with a shared brain"

Wuphf 是一个为 AI Agent 设计的多智能体协作平台，核心理念是：
- **共享大脑**: Claude、Codex、OpenClaw 等多个 Agent 共享上下文，永不丢失记忆
- **可视化协作**: CEO、PM、工程师、设计师、CMO、CRO 等角色可见、争论、认领任务、交付成果
- **24x7 运行**: 自主运行的 AI 办公室

## 架构亮点

### 多 Agent 协作模式
- 多个 AI 角色在同一"办公室"协作
- 任务认领和争用机制
- 实时状态可见性（而非隐藏在 API 后面）

### 共享记忆系统
- 跨 Agent 的上下文共享
- 持续记忆不丢失
- 多 Agent 间的知识同步

### 技术栈
- Go 语言实现（Go 1.25+）
- MCP 协议支持 (`mcp/` 目录)
- Claude Code 插件 (`claude-code-plugin/`)
- Windsurf/Cursor 规则支持 (`.windsurf/`, `.cursor/rules`)

## 项目结构
```
wuphf/
├── mcp/                    # MCP 协议实现
├── claude-code-plugin/     # Claude Code 集成
├── prompts/                # 提示词模板
├── templates/              # 项目模板
├── internal/               # 内部实现
├── web/                    # Web 界面
└── AGENTS.md               # Agent 行为规范
```

## 对 OpenClaw 的意义

### ✅ 架构验证
- **Multi-Agent 协作**: 验证多 Agent 共享上下文的可行性
- **角色分化**: CEO/PM/Engineer/Designer 等角色分工模式
- **可视化需求**: Agent 工作需要可见性而非黑盒

### 🔬 技术启发
- **MCP 集成**: Wuphf 原生支持 MCP，显示协议生态重要性
- **插件生态**: Claude Code/Cursor/Windsurf 多 IDE 支持策略
- **AGENTS.md 模式**: 项目内建 Agent 行为规范文档

### ⚠️ 竞争分析
- **差异化**: Wuphf 侧重"办公室协作"，OpenClaw 侧重"Workflow 执行"
- **互补性**: 可探索 Wuphf + OpenClaw 集成（Wuphf 做协作层，OpenClaw 做执行层）
- **生态位**: "Slack for AI" vs "Execution Engine for AI"

## Critical Questions

1. **协作模式**: OpenClaw 是否应支持多 Agent 并行协作模式？
2. **角色系统**: 是否需要显式的角色定义（Planner/Executor/Critic）？
3. **可视化**: Workflow 执行过程是否需要类似"办公室"的可视化界面？
4. **记忆共享**: Skill 系统是否应支持跨 Session 的 Agent 记忆共享？
5. **MCP 策略**: Wuphf 原生 MCP 支持，OpenClaw 的协议策略是什么？

## 相关链接
- GitHub: https://github.com/nex-crm/wuphf
- HN 讨论: https://news.ycombinator.com/item?id=47899844
