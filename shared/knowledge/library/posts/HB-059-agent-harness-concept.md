# Agent Harness 架构概念 (XHS)

**Source**: 小红书 (Xiaohongshu)  
**Author**: 万有引力AI  
**Date**: 2026-03-24  
**Likes**: 858 | **Collects**: 1509 | **Comments**: 46

---

## 核心观点

**Agent = Model + Harness**

> "如果你不是模型本身，那你就是 Harness"

Harness engineering 指的是我们围绕模型构建系统的方式。模型包含智能，而 harness 让这种智能变得有用。

**关键洞察**: "模型是大宗商品，Harness 才是护城河"

---

## 为什么需要 Harness？

作者指出：今天任何一个 Agent 的表现，取决于两件事：
1. 模型本身的能力
2. 模型之外的工程质量

Context 管理、Memory 设计、Tool 编排、多轮约束、错误恢复——这些东西一直都存在，但没有一个统一的分化。Agent 表现不好，是模型不行还是工程没做好？这便是 Harness 存在的意义：更好地理清楚模型能力和工程能力，分别评估、分别迭代。

---

## Harness 的 5 大核心组件

根据帖子内容，Harness 包含 5 个核心组件：

1. **[组件未明确列出，但图片中应该有详细说明]**
2. **...**
3. **...**
4. **...**
5. **Context Engineering** - 专门解决"怎么管理好上下文窗口这个稀缺资源"的问题

Context 只是 Harness 五大组件中的一个。

---

## 社区反馈亮点

**Kai Mercer 的评论**（获得 4 赞）：
> "可能这个范式严格来说不算新东西。玩 AI 的老玩家们（22 到 23 年就开始的）其实都经历过从 API 开始手搓脚手架，用 Python 去做胶水过程，从 RAG→workflow→skills→agents→Harness（以及微调，记忆管理）各个概念状态的提出，都是对工程化遇到难点的阶段总结。核心的原因就是 LLM 本身是概率机，所做的一切都是让它向你想要的结果的那个概率坍缩。这个过程我的认知里就是蒸馏了日常工程里的项目管理。"

**小羊 AI 雷达**：
> "Prompt engineering 正在被 Harness engineering 取代"

---

## 对我们的意义

### 直接相关性
1. **与 Harness Engineering 研究项目对齐** - 我们正在进行的 `harness-engineering-long-running-agents.md` 研究与此完全吻合
2. **术语标准化** - Harness 提供了一个框架来区分"模型能力"vs"工程能力"
3. **评估分离** - 允许我们分别评估和迭代模型 vs 工程组件

### 可借鉴的实践
- 将 OpenClaw 的架构映射到 Harness 框架：
  - Model: Claude API
  - Harness: EventBus, SessionManager, ToolRegistry, etc.
- 明确哪些问题是模型问题，哪些是工程问题
- 建立 Harness 组件的性能评估指标

---

## 外部链接

- 原帖: https://www.xiaohongshu.com/explore/69c1e9440000000022001c2a

---

**Tags**: #harness-engineering #agent-architecture #system-design #chinese-ai-community
