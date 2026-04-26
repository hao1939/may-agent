---
id: HB-2026-tsinghua-nlah-harness-xhs-69cfb9ad
title: 清华NLAHs：Agent上限由Harness决定
source: 小红书 (XHS) | 清华论文
title_original: Natural-Language Agent Harnesses
url: https://www.xiaohongshu.com/explore/69cfb9ad00000000200380fe
author: 木字旁南方的南
date: 2026-04-03
likes: 547
collects: 719
comments: 24
tags: [tsinghua, harness, nlah, agent-control, architecture, swe-bench, osworld]
---

# 清华新作！Agent上限竟由Harness决定

## 核心创新

论文《Natural-Language Agent Harnesses》提出Agent研究的"隐形天花板"：**Agent的上限不是模型本身，而是harness（高层控制逻辑）！**

### 两大核心贡献

#### 1. NLAHs (自然语言Agent Harness)
将工具调用、失败恢复、状态持久化等控制逻辑，**外部化为可编辑的自然语言规范**。

#### 2. IHR (智能Harness运行时)
统一runtime解析执行NLAHs，**彻底分离共享运行时策略与任务专属逻辑**。

### 解决的问题
- 传统harness全埋在代码、框架私有逻辑里
- 难迁移、难复现、难优化
- 把harness从"胶水代码"变成可研究的**第一类对象**

## 验证基准

- **SWE-bench**: 代码生成与修复
- **OSWorld**: 桌面操作系统交互

证明这套架构可组合、可消融、可迁移。

## 社区讨论精华

**Nova的深度评论**:
> "NLAHs这个思路非常关键，把harness从代码逻辑外部化为自然语言规范，本质上是在做Agent领域的'配置即代码'。这跟Claude Code的CLAUDE.md、OpenClaw的system prompt分层设计是同一个方向：用自然语言定义Agent的行为边界和控制逻辑，而不是硬编码。"
>
> "实际落地中最大的挑战是NLAHs的粒度控制，太粗则失去约束力，太细则退化成伪代码。另外IHR的统一runtime思路很好，但跨任务的NLAHs组合会不会出现冲突？"

**Shush的质疑**:
> "Agent上限由Harness决定不太对吧，harness毕竟只是辅助，可以看看terminalBench得出了相反的结论"

**后院老王的修正**:
> "我觉得是下限由Harness某种程度上决定..."

**XiaoBa的观点**:
> "很明显上限是模型决定的"

**好奇的Ed的类比**:
> "其实挺直观的，一群精英在一起，更需要管理层"

## 可直接落地的延伸创新点

1. **低代码Agent开发平台**: 基于NLAHs让非技术人员快速搭建Agent
2. **自动生成/优化NLAHs**: 结合大模型实现harness的自动迭代
3. **领域定制NLAHs模板**: 针对科研、运维等垂直场景
4. **Agent行为审计**: 用NLAHs解决AI安全与可解释性问题

## 对OpenClaw的意义

### ✅ 方向验证
- **Harness重要性**: 控制逻辑是Agent系统的核心竞争力
- **自然语言配置**: 用自然语言而非代码定义行为边界
- **分层架构**: 运行时策略与任务逻辑分离

### 🔬 研究启发

**同方向学生可写的思路**:
1. 找"隐性工程问题"做研究对象（如Agent调度、状态管理）
2. 做"架构级创新"而非单点优化
3. 用SWE-bench + OSWorld两大经典基准做实验

### 💡 架构启示

| 层级 | 对应OpenClaw | 功能 |
|------|--------------|------|
| NLAHs | L0-L2 System Prompts | 行为定义 |
| IHR | OpenClaw Runtime | 执行引擎 |
| Task Logic | L3 Task Context | 任务专属 |

### ⚠️ 待解决问题

1. **粒度控制**: NLAHs应该有多详细？
2. **组合冲突**: 多个NLAHs如何协调？
3. **性能开销**: 自然语言解析 vs 硬编码性能差距

---
*Collected by Amy-Kimi Heartbeat | 2026-04-26*
