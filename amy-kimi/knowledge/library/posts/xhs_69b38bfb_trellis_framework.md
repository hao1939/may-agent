# GitHub爆火AI框架Trellis

**Post ID**: 69b38bfb000000001a027fb4
**Source**: XHS (Github工具拾遗)
**Date**: 2026-03-13
**Likes**: 5 | **Collects**: 9

---

## TL;DR
Trellis是一个"All-in-one AI框架"，通过.trellis/文件夹实现spec声明式注入，结合Git worktree实现并行AI任务执行，将AI从"对话式"转向"声明式"协作。

---

## 核心概念

### Trellis是什么？
Trellis英文原意是"格架"——引导AI规范生长的支架。一套针对AI智能体设计的任务编排和规范注入系统。

### 核心黑科技：Spec注入"肌肉记忆"

| 模式 | 传统方式 | Trellis方式 |
|-----|---------|-------------|
| 交互方式 | 对话式 | 声明式 |
| 规范传递 | 每次会话重复解释 | .trellis/文件夹自动注入 |
| 角色定位 | AI的搬运工 | AI的总架构师 |

通过项目中的 `.trellis/` 文件夹定义所有spec（规格说明）：
- 前端组件规范
- 后端架构逻辑
- 特定工作流

AI开启会话瞬间自动注入，无需重复解释项目架构、编码习惯和业务逻辑。

### 并行化生产：/trellis:parallel

结合Git worktree技术，允许同时启动多个AI任务：
- 下达三个任务指令
- 自动创建三个隔离开发环境
- Claude/GPT在各自分支上同时编写代码
- 最后Review和合并

**效率提升不是线性的，而是指数级的。**

### 持续上下文记忆
- 任务PRD概念
- 工作日志记录每次任务执行过程、决策依据
- 跨会话/跨Agent时后继者可无缝衔接上下文

---

## 项目信息
- **GitHub**: mindfold-ai/Trellis
- **定位**: AI协作标准建立者
- **目标**: 让AI从聊天机器人变成守规矩、懂业务、能多线程工作的虚拟开发团队

---

## 关键洞察
1. **Spec注入模式**: 与AGENTS.md被动上下文注入高度一致，验证声明式规范注入是社区共识方向
2. **并行任务执行**: Git worktree隔离+并行执行，验证Harness层需要支持多工作空间
3. **上下文持久化**: 任务PRD+工作日志模式，验证经验固化需要结构化存储
4. **AI协作标准**: 从"对话"到"协作"的范式转移正在进行

---

## 与我们架构的关联
| Trellis概念 | 我们的对应 |
|------------|-----------|
| .trellis/ spec注入 | AGENTS.md 100%被动上下文注入 |
| Git worktree并行 | Channel多实例 + Gateway路由 |
| 任务PRD | Skill定义 + 执行日志 |
| 工作日志 | Runtime执行追踪 |

---

## L3 Flag
- **#363** | Spec声明式注入: 从对话式到声明式的范式转移
- **#364** | Git worktree并行: 多Agent隔离执行的技术实现
- **#365** | 任务PRD模式: 跨会话上下文持久化方案

---

**Relevance**: Architecture | Spec Injection | Parallel Execution | Context Management
**Related**: HB#237 (Karpathy autoresearch), HB#236 (Claude Memory二分法)
