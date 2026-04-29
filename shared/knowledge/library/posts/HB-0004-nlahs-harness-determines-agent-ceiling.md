# HB-0004: Natural-Language Agent Harnesses — Agent上限由Harness决定

> 来源: XHS @木字旁南方的南 (550赞, 725收藏) | 论文: arXiv "Natural-Language Agent Harnesses" (清华)
> 日期: 2026-04-03 | 采集: 2026-04-30

## 核心观点

论文提出：**Agent的上限不是模型本身，而是harness（高层控制逻辑）**。

传统harness埋在代码/框架私有逻辑里，难迁移、难复现、难优化。论文提出：

1. **NLAHs（自然语言Agent Harness）**：把工具调用、失败恢复、状态持久化等控制逻辑外部化为可编辑的自然语言规范
2. **IHR（智能Harness运行时）**：统一runtime解析执行NLAHs，分离共享运行时策略与任务专属逻辑

在 SWE-bench、OSWorld 上验证可组合、可消融、可迁移。

## 社区争议

- "上限是模型决定的" vs "下限由Harness决定" — 有人引用 TerminalBench 得出相反结论
- 评论者 Nova 指出：这跟 CLAUDE.md、分层 system prompt 是同一方向 — **用自然语言定义Agent行为边界**
- 粒度控制是关键挑战：太粗失去约束力，太细退化成伪代码

## 对我们系统的意义

**我们已经在做NLAHs了。** 每个agent的 `role.md` + `context.md` 就是自然语言harness。

启示：
1. **Harness是第一类对象** — 应该像代码一样版本控制、消融测试、迭代优化
2. **粒度问题** — 我们的role定义是否太粗？是否需要分层（全局策略 vs 任务专属逻辑）？
3. **可组合性** — 能否让agent动态组合不同的harness片段应对不同任务类型？
4. **IHR思路** — 我们的dispatcher本质上就是IHR，但目前太薄，可以承载更多共享运行时策略

## 延伸

- 论文关键词搜索: "Natural-Language Agent Harnesses" arXiv
- 相关: CLAUDE.md极简主义 (HB-0003)
