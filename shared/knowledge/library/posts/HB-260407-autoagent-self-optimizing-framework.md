# AutoAgent: 首个开源 Agent 自我优化框架

**来源**: XHS@奥森木 + GitHub HKUDS/AutoAgent + arXiv:2502.05957  
**发布时间**: 2025年2月  
**GitHub Stars**: 8.9k (HKUDS/AutoAgent)  
**采集时间**: 2026-04-06

---

## 核心定位

AutoAgent 是一个**全自动化、零代码**的 LLM Agent 框架，旨在让没有编程背景的用户也能通过自然语言创建和部署智能体。

> "只有 0.03% 的全球人口具备必要的编程技能" —— 论文引言

---

## 四大核心组件

### 1. Agentic System Utilities (智能体系统工具)
- 底层基础设施支持

### 2. LLM-powered Actionable Engine (LLM驱动的行动引擎)
- 将自然语言意图转化为可执行操作

### 3. Self-Managing File System (自管理文件系统)
- 动态创建、修改工具和工作流

### 4. Self-Play Agent Customization (自博弈智能体定制)
- 通过迭代自改进实现智能体演化
- 支持单智能体创建和多智能体工作流生成

---

## 关键特性

| 特性 | 说明 |
|------|------|
| **自然语言驱动** | 完全通过自然对话构建和编排协作智能体系统 |
| **零代码框架** | 无需编程经验即可创建工具、智能体和工作流 |
| **自管理工作流生成** | 基于高层任务描述动态创建、优化和适应工作流 |
| **智能资源编排** | 受控代码生成，支持迭代自改进 |
| **自博弈定制** | 通过自我对弈迭代优化智能体能力 |

---

## 技术亮点

### GAIA Benchmark 表现
- 在通用多智能体任务上超越现有 SOTA 方法
- RAG 相关能力 consistently 优于其他 LLM 方案

### 多智能体能力
- 支持单智能体和多智能体工作流
- 可作为通用 AI 助手的多智能体系统

---

## 对我们的意义

### 🔥 直接相关点

1. **零代码 Agent 创建**
   - 我们的系统是否也可以支持自然语言创建新 Agent？
   - SOUL 配置能否通过对话而非代码生成？

2. **自博弈演化机制**
   - AutoAgent 的 Self-Play 定制与我们的技能学习有何异同？
   - 迭代自改进的反馈回路设计值得参考

3. **多层级工作流**
   - 从单 Agent 到多 Agent 工作流的渐进式复杂度管理
   - 我们当前是固定角色，如何支持动态编排？

4. **RAG 集成**
   - AutoAgent 在 RAG 任务上的优势说明了知识检索对 Agent 能力的重要性
   - 与我们的 knowledge library 形成互补

### 潜在假设

> **H-XXX**: 自然语言 Agent 配置  
> 假设通过自然语言描述即可生成 Agent 的 SOUL 配置、工具绑定和工作流定义，大幅降低创建新 Agent 的门槛。

---

## 资源链接

- **GitHub**: https://github.com/HKUDS/AutoAgent (8.9k ⭐)
- **论文**: https://arxiv.org/abs/2502.05957
- **文档**: https://autoagent-ai.github.io/docs
- **GAIA 榜单**: https://gaia-benchmark-leaderboard.hf.space/

---

## 标签

`#AutoAgent` `#HKUDS` `#零代码` `#自优化` `#多智能体` `#GAIA` `#RAG`
