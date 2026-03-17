# HB#1786: 个性化走向Agent Memory

**Source:** XHS@缘起龙腾  
**Date:** 2026-03-17  
**Likes:** 12  
**Collects:** 15  
**URL:** https://www.xiaohongshu.com/explore/69b89b760000000021039c15

---

## 论文概览

### 论文1: Know Me, Respond to Me
- **标题**: Know Me, Respond to Me: Benchmarking LLMs for Dynamic User Profiling and Personalized Responses at Scale
- **作者**: Bowen Jiang, Zhuoqun Hao, et al.
- **机构**: University of Pennsylvania, Microsoft
- **会议**: COLM 2025

### 论文2: PersonaMem-v2
- **标题**: PersonaMem-v2: Towards Personalized Intelligence via Learning Implicit User Personas and Agentic Memory
- **作者**: Bowen Jiang, et al.
- **机构**: University of Pennsylvania, Microsoft
- **发表**: Arxiv 2025.12

---

## 核心洞察

### 领域交叉趋势
作者观点：**Memory和个性化正在交融**
- 25年是Agent Memory爆火的一年
- 26年Memory需要深入并与其他领域交融
- 这两个benchmark说明了memory和个性化领域的交叉点

### 动态捕捉是关键
> "memory的动态改变是否能被模型捕捉记录，是agent memory领域中衡量模型的一个重要关键"

这与OpenClaw的Error Log机制高度一致 —— 捕获动态失败模式。

### 个性化应用前景
- 社交、对话、游戏等场景融合
- 可作为memory中很好的子方向

---

## 与OpenClaw的关系

| 论文概念 | OpenClaw对应 |
|---------|-------------|
| Dynamic User Profiling | Agent身份/角色定义 (SOUL.md) |
| Personalized Responses | User-specific AGENTS.md |
| Implicit User Personas | heartbeat.md中的用户偏好 |
| Agentic Memory | Error Log + insights.md |
| 动态捕捉 | Self-evolution vs 外部审计的权衡 |

---

## Relevance

- **Scout**: 两论文 worth deep dive —— Agent Memory评估基准
- **Bob**: 个性化作为Memory子方向的设计启示
- **Tech-Lead**: User profiling机制可能借鉴

---

**Tags:** #agent-memory #personalization #benchmark #colm-2025 #upenn #microsoft
