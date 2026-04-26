# 清华NLAH: Agent上限由Harness决定

**来源**: 小红书 @木字旁南方的南 | 清华大学arXiv论文  
**赞数**: 547 | 收藏: 720 | 评论: 24  
**论文**: Natural-Language Agent Harnesses  
**原文链接**: https://www.xiaohongshu.com/explore/69cfb9ad00000000200380fe  
**时间**: 2025-04

---

## 核心发现

**Agent的上限不是模型本身，而是harness（高层控制逻辑）！**

传统harness全埋在代码、框架私有逻辑里，导致：
- 难迁移
- 难复现  
- 难优化

---

## 两大核心创新

### 1. NLAHs (自然语言Agent Harness)
把工具调用、失败恢复、状态持久化等控制逻辑，**外部化成可编辑的自然语言规范**。

### 2. IHR (智能Harness运行时)
统一runtime解析执行NLAHs，**彻底分离共享运行时策略与任务专属逻辑**。

---

## 实验验证

在**SWE-bench** (代码) + **OSWorld** (桌面操作) 两大基准验证：
- ✅ 可组合
- ✅ 可消融
- ✅ 可迁移

把harness从"胶水代码"变成了**可研究的第一类对象**。

---

## 社区讨论亮点

| 评论者 | 观点 |
|--------|------|
| @Shush | "Agent上限由Harness决定不太对吧，可以看看TerminalBench得出相反结论" |
| @后院老王 | "我觉得是下限由Harness某种程度上决定..." (5赞) |
| @XiaoBa | "很明显上限是模型决定的" |
| @Nova | "NLAHs本质上是做Agent领域的'配置即代码'，跟Claude Code的CLAUDE.md、OpenClaw的system prompt分层设计是同一个方向" |
| @好奇的Ed | "一群精英在一起，更需要管理层" |

---

## 研究思路启示

### 同方向学生可写思路
1. **找"隐性工程问题"**: 把大家习以为常的工程经验抽象成可形式化、可实验的科学问题
2. **做"架构级创新"**: 不局限于单点优化，而是重构整个控制层设计范式
3. **用经典基准**: SWE-bench + OSWorld覆盖多场景，实验说服力拉满

### 可落地延伸
1. 基于NLAHs做低代码Agent开发平台
2. 结合大模型自动生成/优化NLAHs
3. 针对特定领域(科研/运维)定制NLAHs模板
4. 用NLAHs做Agent行为审计，解决AI安全与可解释性

---

## 对OpenClaw的意义

### ✅ 验证
- **分层架构**: L0意图理解/L1规划/L2执行 与 NLAHs理念一致
- **自然语言控制**: AGENTS.md作为自然语言harness的独立验证
- **外部化规范**: 用Markdown而非代码定义行为边界

### 🔬 可探索
- **Harness粒度控制**: Nova指出的挑战 — "太粗则失去约束力，太细则退化成伪代码"
- **跨任务组合**: NLAHs跨任务组合是否会出现冲突？
- **运行时分离**: IHR的统一runtime思路如何映射到OpenClaw架构？

### ⚠️ 讨论
- **上下限之争**: Harness决定的是"下限"还是"上限"？
- **模型vs控制**: 模型能力 vs 控制逻辑的权重如何平衡？

---

## 关键洞察

> "配置即代码" — NLAHs把harness从代码逻辑外部化为自然语言规范

> "一群精英在一起，更需要管理层" — 控制逻辑的重要性

---

## 相关

- [HB-260428-agno-agent-runtime-framework](HB-260428-agno-agent-runtime-framework.md) - Agno三层架构
- [insights-cn.md](../insights-cn.md) - 控制层设计模式
