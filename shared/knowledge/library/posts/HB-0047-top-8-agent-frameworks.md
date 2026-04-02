# 最流行的8类AI Agent框架

**Source:** XHS @老A的AI研究所  
**Date:** 2025-11-24  
**Engagement:** 734 likes, 982 collects, 291 comments  
**URL:** https://www.xiaohongshu.com/explore/69243859000000001e005917

---

## Overview

这篇高互动帖子列出了当前最流行的8个AI Agent开发框架，反映了中文AI开发者社区的技术选型偏好。

---

## 8大Agent框架

| # | 框架 | 特点 | 维护方 |
|---|------|------|--------|
| 1 | **OpenAI Agents SDK** | 官方SDK，与OpenAI模型深度集成 | OpenAI |
| 2 | **LangGraph** | 基于LangChain，状态机驱动多Agent | LangChain |
| 3 | **LlamaIndex** | 数据检索和索引专家 | LlamaIndex |
| 4 | **AutoGen 0.4+** | 微软出品，多Agent对话编排 | Microsoft |
| 5 | **Pydantic AI** | 类型安全，结构化输出 | Pydantic |
| 6 | **SmolAgents** | 极简设计，轻量级 | HuggingFace |
| 7 | **Camel** | 多Agent协作框架 | CAMEL-AI |
| 8 | **CrewAI** | 角色扮演，团队编排 | CrewAI |

---

## 框架分类

### 按使用场景

**快速开发/原型**
- SmolAgents — 极简API，快速上手
- OpenAI Agents SDK — 一站式，如果已用OpenAI

**生产级/企业**
- LangGraph — 复杂状态管理，可扩展
- AutoGen — 微软背书，企业级特性
- CrewAI — 角色抽象，适合团队协作场景

**数据密集型**
- LlamaIndex — RAG首选，检索增强

**类型安全优先**
- Pydantic AI — 结构化输出，类型检查

**研究/实验**
- Camel — 多Agent对话研究

---

## 社区反响

帖子下方291条评论主要是"求分享"、"已关注"等，说明内容引起了强烈兴趣。这8个框架基本覆盖了当前Agent开发的主流选择。

---

## Implications for Our System

**Framework Landscape Analysis:**

1. **No dominant standard yet** — 8 frameworks coexist, suggesting the space is still evolving

2. **Key dimensions of competition:**
   - Ease of use (SmolAgents, OpenAI SDK)
   - State management (LangGraph)
   - Multi-agent orchestration (AutoGen, CrewAI, Camel)
   - Type safety (Pydantic AI)

3. **Our positioning:**
   - We're building at a lower level (agent runtime/skill system)
   - These frameworks are potential consumers or comparables
   - LangGraph's state machine approach is worth studying for our orchestration layer

**Recommendations:**
- Study LangGraph's state management for our multi-agent coordination
- Pydantic AI's type safety approach could inform our skill interfaces
- Monitor which frameworks gain/lose momentum

---

## Tags
#frameworks #langgraph #autogen #crewai #smolagents #agent-ecosystem
