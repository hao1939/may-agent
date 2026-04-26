# HB-0035: Superpowers — 168K Stars的Agent Skills框架

## Source
- **项目**: obra/superpowers  
- **GitHub**: https://github.com/obra/superpowers
- ** stars**: 168K (截至2026-04-28)
- **作者**: Jesse Vincent (Prime Radiant)
- **协议**: MIT

## 核心定位

> "A complete software development methodology for your coding agents, built on top of a set of composable skills and some initial instructions that make sure your agent uses them."

Superpowers是一个**完整的AI编程Agent方法论**，基于可组合的Skills和初始指令，确保Agent按规范使用它们。

---

## 架构亮点

### 1. 多平台统一支持
支持6个主流AI编程工具，Skills跨平台通用：

| 平台 | 安装方式 |
|------|----------|
| Claude Code | `/plugin install superpowers@claude-plugins-official` |
| OpenAI Codex CLI | `/plugins` 搜索安装 |
| Cursor | `/add-plugin superpowers` |
| GitHub Copilot CLI | `copilot plugin install` |
| Gemini CLI | `gemini extensions install` |
| OpenCode | 直接fetch安装 |

**关键洞察**: Skills不是平台绑定，而是**方法论层面的可移植资产**。

### 2. 7步强制工作流

Skills作为**强制工作流**自动触发，而非可选建议：

```
brainstorming → using-git-worktrees → writing-plans → 
subagent-driven-development → test-driven-development → 
requesting-code-review → finishing-a-development-branch
```

| 阶段 | 触发条件 | 核心产出 |
|------|----------|----------|
| **brainstorming** | 写代码前 | 设计文档 (分块展示供验证) |
| **using-git-worktrees** | 设计批准后 | 隔离工作区 + 干净测试基线 |
| **writing-plans** | 实施前 | 2-5分钟/任务的详细计划 |
| **subagent-driven-development** | 执行计划 | 子Agent并行开发 + 两级审查 |
| **test-driven-development** | 实现中 | 强制RED-GREEN-REFACTOR |
| **requesting-code-review** | 任务间 | 合规审查 + 代码质量审查 |
| **finishing-a-development-branch** | 任务完成 | 合并/PR/清理决策 |

### 3. Subagent-Driven Development (子Agent驱动开发)

**核心原则**: Fresh subagent per task + two-stage review

```
┌─────────────────┐
│ 读取计划提取任务  │
└────────┬────────┘
         ▼
┌─────────────────┐     ┌─────────────────┐
│ 派生实现子Agent  │────▶│ 规格合规审查者   │
│ (精确上下文)     │     │ (验证符合计划)   │
└─────────────────┘     └────────┬────────┘
                                 │ 通过?
                    否 ◄─────────┘ 是
                    │             ▼
                    │    ┌─────────────────┐
                    └────│ 代码质量审查者   │
                         │ (代码质量评估)   │
                         └────────┬────────┘
                                  │ 通过?
                     否 ◄─────────┘ 是
                     │
                     ▼
              标记任务完成
```

**模型选择策略** (成本优化):
- 机械实现任务 (1-2文件, 明确规格): **快速便宜模型**
- 集成判断任务 (多文件协调, 调试): **标准模型**
- 架构设计任务: **最强可用模型**

**四种状态处理**:
- `DONE` → 进入审查
- `DONE_WITH_CONCERNS` → 先处理concerns
- `NEEDS_CONTEXT` → 补充上下文重派
- `BLOCKED` → 评估原因(上下文/模型能力/任务粒度/计划错误)

---

## Skill设计规范

### 目录结构
```
skills/
  skill-name/
    SKILL.md              # 主文档 (必需)
    supporting-file.*     # 辅助文件 (如需要)
```

### SKILL.md 标准格式
```yaml
---
name: skill-name-with-hyphens
description: Use when [具体触发条件和症状]
---

# Skill Name

## Overview
1-2句话说明核心原则

## When to Use
- 使用场景 (具体症状)
- 何时不使用

## Core Pattern
前后对比代码示例

## Quick Reference
表格或要点供快速查阅

## Implementation
内联代码或链接辅助文件

## Common Mistakes
常见错误 + 修复方法
```

### 关键约束

**Token效率目标**:
- getting-started工作流: **<150词**
- 频繁加载Skills: **<200词**
- 其他Skills: **<500词**

**Description字段法则** (Claude Search Optimization):
```yaml
# ❌ BAD: 描述工作流程
description: 执行计划时分派子Agent进行代码审查

# ✅ GOOD: 仅描述触发条件  
description: Use when executing implementation plans with independent tasks in the current session
```

**关键洞察**: 当description总结workflow时，Claude会按description执行而非读取完整skill，导致行为偏离。

---

## Skills Library (技能库)

### Testing
- **test-driven-development** — RED-GREEN-REFACTOR循环

### Debugging  
- **systematic-debugging** — 4阶段根因分析
- **verification-before-completion** — 修复验证

### Collaboration
- **brainstorming** — 苏格拉底式设计细化
- **writing-plans** — 详细实施计划
- **executing-plans** — 批量执行 + 检查点
- **dispatching-parallel-agents** — 并发子Agent工作流
- **requesting-code-review** — 预审查清单
- **using-git-worktrees** — 并行开发分支
- **subagent-driven-development** — 快速迭代 + 两级审查

### Meta
- **writing-skills** — 创建新技能 (TDD方法论)
- **using-superpowers** — Skills系统入门

---

## 方法论核心

### Skills = TDD应用于流程文档

| TDD概念 | Skill创建对应 |
|---------|---------------|
| Test case | 压力场景 + subagent测试 |
| Production code | Skill文档 (SKILL.md) |
| Test fails (RED) | Agent无skill时违规(基线) |
| Test passes (GREEN) | 有skill时Agent合规 |
| Refactor | 堵住漏洞同时保持合规 |

**核心原则**: "If you didn't watch an agent fail without the skill, you don't know if the skill teaches the right thing."

### 哲学
- **Test-Driven Development** — 始终先写测试
- **Systematic over ad-hoc** — 流程优于猜测
- **Complexity reduction** — 简洁是首要目标
- **Evidence over claims** — 验证后才声明成功

---

## 对OpenClaw的意义

### ✅ 验证的设计选择
1. **Skills作为核心抽象** — 168K stars验证Skills是Agent生态的正确层级
2. **跨平台可移植性** — Skills可在Claude/Cursor/Codex间共享，与我们的AGENTS.md理念一致
3. **强制工作流** — Skills自动触发而非被动查询，可考虑类似的主动性设计
4. **SubAgent模式** — 两级审查(规格+质量)的质量保证机制值得借鉴
5. **Token效率意识** — <200词高频skills的约束与我们的Context优化方向一致

### 🔬 值得探索的方向
1. **CSO (Claude Search Optimization)** — Description字段优化技能发现，可应用于我们的Skill选择算法
2. **模型分层路由** — 按任务复杂度选择模型能力，而非统一使用最强模型
3. **TDD for Skills** — 用RED-GREEN-REFACTOR方法论测试Skill有效性
4. **工作流模板化** — 7步标准工作流可作为复杂任务的默认编排

### ⚠️ 关键差异
| 维度 | Superpowers | OpenClaw |
|------|-------------|----------|
| 持久性 | 会话级 | 7x24持久运行 |
| 记忆 | 工具内记忆 | 长期文件记忆 |
| 远程控制 | ❌ | ✅ |
| 多Agent | SubAgent临时派生 | 固定角色团队 |
| 部署 | 插件化 | 基础设施级 |

**融合机会**: "让OpenClaw学会使用Superpowers技能系统"

---

## 关键引用

> "It starts from the moment you fire up your coding agent. As soon as it sees that you're building something, it doesn't just jump into trying to write code. Instead, it steps back and asks you what you're really trying to do."

> "There's a bunch more to it, but that's the core of the system. And because the skills trigger automatically, you don't need to do anything special. Your coding agent just has Superpowers."

---

## 相关资源

- **Discord**: https://discord.gg/35wsABTejz
- **Release Notes**: https://primeradiant.com/superpowers/
- **Original Announcement**: https://blog.fsck.com/2025/10/09/superpowers/
- **agentskills.io/specification**: Skill规范标准

---

*HB-0035 | Amy-Kimi Heartbeat | 2026-04-28*
