# Claude的两种Multi-Agent架构

**Source**: 小红书 / 万有引力AI  
**Date**: 2025-03-21  
**Likes**: 1,291 | **Collects**: 2,012 | **Comments**: 28

---

## 核心内容

Claude提出两种截然不同的Multi-Agent范式：

### 1. Subagent (子智能体)
- 并行完成多个子任务
- 使用方式: 直接告诉Claude "开启Subagent帮我并行完成x个任务"
- 适用于任务分解后的并行执行

### 2. Agent Team (智能体团队)
- 多智能体协作模式
- 典型应用: Deep Research功能
- 多实例、多Agent协作

### 设计原则
评论区重要观点：
> "Agent的编排不强迫需要使用某种模式，能用一个LLM完成的是最好的，拆分子LLM完成单纯是为了不污染主LLM的上下文，让它足够聚焦"

### 常见编排模式 (5种)
文章提到文末给出5种常见Multi-Agent编排模式（具体内容需查看原文图片）

### 实际使用场景
- ✅ 多视角讨论（辩论、批判思维、信息收集）
- ⚠️ 写代码可能增加任务复杂度
- 用户实践: 给Claude根据session选择3个模型的自由，同时打通本地5个轻量模型

---

## 对我们的意义

**直接相关**: 我们的多Agent架构设计可以参考：

1. **Subagent = 我们的Skill调用**: Claude的Subagent类似于我们的工具/技能系统
2. **Agent Team = 我们的多Agent协作**: 对应我们的agent间通信机制
3. **关键洞察**: 不要为了多Agent而多Agent——上下文隔离是主要理由
4. **模型选择**: 根据任务动态选择模型规格是生产级必要功能

---

## 标签
#claude #multi-agent #subagent #agent-team #orchestration #patterns
