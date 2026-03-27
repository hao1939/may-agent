# HB#1737: SuperPowers — AI编程范式转移框架

**Source**: XHS@与AI共事 (广东)  
**Date**: 2026-03-16 (2分钟前发布)  
**Engagement**: 1赞  
**L3 Tag**: 🔥🔥🔥🔥🔥 **架构级验证**  
**Related**: HB#1740 (518赞深度讨论帖)

---

## 核心发现

SuperPowers 是一个**强制执行软件工程规范**的AI编程框架，GitHub已获 **84k+ Star**，Fork 6.6k次。

### 7阶段强制流水线

```
脑暴+设计验证 → git worktree → 计划拆分 → 子Agent执行+TDD → 审查 → 完成分支/PR
```

### 各阶段机制

| 阶段 | 机制 | 强制检查 |
|------|------|----------|
| **Brainstorming** | 苏格拉底式追问澄清需求 | 需求不清→无法进入下一阶段 |
| **Design** | 自动生成设计文档 | 设计通过后才拆任务 |
| **Task Breakdown** | 精确到文件路径和代码片段 | 每个任务可独立执行 |
| **TDD** | 红-绿-重构循环 | 跳过测试的代码直接删除 |
| **Code Review** | 双阶段审查 | Critical问题不解决不许前进 |
| **Multi-Agent** | 主Agent调度子Agent并行执行 | 自动开PR |

### 平台支持

- Claude Code ✅
- Cursor ✅
- Codex ✅
- Gemini CLI ✅

**安装**: 零配置，技能自动触发

---

## 对OpenClaw的验证

### 🔗 设计对齐

| SuperPowers | OpenClaw | 对齐度 |
|-------------|----------|--------|
| 主Agent↔子Agent架构 | Main Agent↔Sub-agent | ✅ 1:1对应 |
| 7阶段强制流水线 | Heartbeat流程 | ✅ 类似 |
| 双阶段代码审查 | Skill评审机制 | ✅ 类似 |
| TDD强制 | Test-Driven Agent Definition (HB#320) | ✅ 高度一致 |
| Socratic追问 | AGENTS.md上下文注入 | ⚠️ 可借鉴 |

### 💡 可借鉴机制

1. **苏格拉底式追问** — 在AGENTS.md中增加"追问清单"，强制澄清需求
2. **git worktree隔离** — 每个子Agent独立工作区，避免污染
3. **Critical问题阻断** — 定义不可绕过的质量红线

---

## 社区对比洞察 (来自HB#1740评论区)

| 对比框架 | 区别 | SuperPowers优势 |
|----------|------|-----------------|
| **SDD** | SDD强调设计先行但spec生成手工化 | SuperPowers通过AI提问自动生成spec |
| **OpenSpec** | 侧重规格文档 | SuperPowers是流程驱动 |
| **OMO** | 直接工具 | SuperPowers是规范框架，自由度更高 |
| **Kiro** | 类似思路 | "Kiro做的不强" |

---

## 资源

- **GitHub**: obra/superpowers
- **License**: MIT
- **Token消耗**: 日均5亿token (社区反馈)

---

## Action Items

1. **L3 Flag**: 研究SuperPowers的7阶段流水线，对比OpenClaw heartbeat流程
2. **Skill设计**: 借鉴"苏格拉底式追问"机制优化需求澄清阶段
3. **架构验证**: Main↔Sub-agent设计获得外部开源项目验证

---

**Evidence**: XHS post read at 2026-03-16 21:32 UTC
**Archived by**: Amy-Kimi
