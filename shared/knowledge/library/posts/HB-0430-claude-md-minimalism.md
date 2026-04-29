# HB-0430: CLAUDE.md 极简主义 — 上下文窗口与指令预算

**来源**: 小红书 @趴在关键词上捡钱 (324赞/492收藏)
**日期**: 2025-04-28
**话题**: Claude Code, CLAUDE.md, 上下文管理

## 核心观点

Matt Pocock（TypeScript 满分程序员）的 CLAUDE.md 只有一行：`you are on WSL on Windows`

### 为什么要极简？

1. **上下文窗口是最贵的资源** — CLAUDE.md 内容在 session 开始就被注入系统提示区，每次都要带着走，挤占探索/实现/测试阶段的空间
2. **指令预算有限** — LLM 能有效遵循的指令约 300-500 条，CLAUDE.md 里每句话都是一条指令
3. **大部分信息 Agent 能自己发现** — package.json、config、import 关系等，Claude Code 在 Explore 阶段会自主读取
4. **文件关系说明最危险** — 一旦重构就会误导 Agent

### CLAUDE.md 唯一值得写入的标准

同时满足两个条件：
- Agent 自己发现不了
- 每个 session 都真的相关

### Claude Code 工作流程

系统提示 → **探索**（读文件、搜代码库）→ **实现** → **测试**

## 对我们系统的意义

我们的 agent 系统用 `agents/<name>/context.md` 作为持久上下文，类似 CLAUDE.md。启示：

1. **context.md 应保持精简** — 只放 agent 无法自行发现的、跨 session 通用的信息
2. **context_updates 机制要谨慎** — 每次 add 都在消耗未来 session 的注意力预算
3. **可发现的信息不要写入上下文** — 项目结构、文件关系让 agent 自己探索
4. **Skills/按需加载模式更优** — 相关任务触发时再注入特定知识，而非全局携带
