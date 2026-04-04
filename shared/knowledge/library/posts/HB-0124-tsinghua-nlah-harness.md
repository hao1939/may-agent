# 清华新作：Natural-Language Agent Harnesses (NLAH)

**Source**: 小红书 @木字旁南方的南 | Tsinghua  
**Paper**: Natural-Language Agent Harnesses (arXiv)  
**Date**: 2026-04-03  
**Likes**: 218 | **Collects**: 307 | **Comments**: 6

---

## 核心观点

> "Agent的上限，早就不是模型本身，而是 harness（高层控制逻辑）"

---

## 核心创新

### 问题识别
传统 harness 全埋在代码、框架私有逻辑里，导致：
- 难迁移 (Hard to migrate)
- 难复现 (Hard to reproduce)
- 难优化 (Hard to optimize)

### 两大核心贡献

#### 1. NLAHs (Natural-Language Agent Harnesses)
把工具调用、失败恢复、状态持久化等控制逻辑，**外部化成可编辑的自然语言规范**。

#### 2. IHR (Intelligent Harness Runtime)
统一 runtime 解析执行 NLAHs，彻底分离：
- 共享运行时策略 (Shared runtime strategies)
- 任务专属逻辑 (Task-specific logic)

---

## 验证基准

- **SWE-bench** (代码任务)
- **OSWorld** (桌面操作任务)

**结果**: 证明这套架构可组合、可消融、可迁移，把 harness 从"胶水代码"变成了可研究的**第一类对象**。

---

## 研究方法论启示

### 可借鉴的研究思路

1. **找"隐性工程问题"做研究对象**
   - 把大家习以为常的工程经验（如 Agent 调度、状态管理）
   - 抽象成可形式化、可实验的科学问题

2. **做"架构级创新"而非单点优化**
   - 不局限于某一个模块的提升
   - 重构整个控制层的设计范式

3. **用经典基准做实验**
   - SWE-bench + OSWorld 覆盖多场景
   - 实验说服力更强

---

## 可直接落地的创新点

1. **低代码 Agent 开发平台**
   - 基于 NLAHs，让非技术人员快速搭建 Agent

2. **Harness 自动迭代**
   - 结合大模型自动生成/优化 NLAHs

3. **垂直场景模板**
   - 针对科研、运维等定制 NLAHs 模板

4. **Agent 行为审计**
   - 用 NLAHs 解决 AI 安全与可解释性问题

---

## 社区金句

**Herrychess the dragon**:
> "不是说 Gemini 就是靠修改 harness 降智的吗"

**作者回应**:
> "harness 改坏了，模型再强也白搭"

---

## 与我们的 Harness Engineering 研究的相关性

### 高度相关

| NLAH 概念 | OpenClaw 对应 |
|-----------|--------------|
| NLAHs (自然语言规范) | skills/*.md, SOUL.md |
| IHR (统一运行时) | EventBus, SessionManager |
| 工具调用外部化 | ToolRegistry |
| 失败恢复 | errorHandler, retry logic |
| 状态持久化 | context.md, 文件系统 |

### 可借鉴的设计

1. **自然语言化 Harness**: 我们的 skills 已经是自然语言，但缺乏标准化的 harness 描述语言
2. **分离策略与逻辑**: 当前实现有一定耦合，可更明确分离
3. **可审计性**: NLAHs 的自然语言形式天然支持审计

### 假设关联

- **H-056 P4**: 决策拓扑理论中，harness 属于系统层决策，影响整体效能
- **Harness Engineering 研究项目**: NLAH 提供了一个形式化框架，可作为对比基准

---

## 外部链接

- 原帖: https://www.xiaohongshu.com/explore/69cfb9ad00000000200380fe

---

**Tags**: #harness-engineering #nlah #tsinghua #agent-architecture #research-methodology
