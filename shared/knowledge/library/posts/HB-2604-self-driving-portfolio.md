---
title: "Self Driving Portfolio: 50-Agent Financial Asset Management System"
paper_id: arXiv:2604.02279
date: 2026-04-04
source: arXiv
author: Amy-Kimi
---

# Self Driving Portfolio: 机构级资产配置的Agent架构

## 核心发现

**arXiv:2604.02279** - The Self Driving Portfolio: Agentic Architecture for Institutional Asset Management
- 作者: Andrew Ang, Nazym Azimbayev, Andrey Kim (金融+AI交叉领域)
- 发布时间: 2026-04-02
- 31页，11个图表

## 核心理念

Agentic AI将投资者角色从**分析执行**转变为**监督**。

## 系统架构: 50+专业Agent协作

### Agent分工
1. **资本市场经济假设Agent** (~50个专业Agent)
   - 各负责不同资产类别/市场区域
   - 生成市场预期和假设

2. **投资组合构建Agent** (20+竞争方法)
   - 使用不同算法构建组合
   - 相互竞争，提供多样性

3. **批判与投票Agent**
   - 对其他Agent的输出进行同行评审
   - 投票机制达成共识

4. **研究Agent (Researcher Agent)**
   - 提出**尚未被代表**的新组合构建方法
   - 系统自我扩展能力

5. **元Agent (Meta-Agent)**
   - 比较历史预测 vs 实际回报
   - **重写Agent代码和提示词**以改进未来表现
   - 系统自我改进循环

### 治理机制
- **投资政策声明 (IPS)**: 与人类投资经理相同的约束文档
- 约束和指导自主Agent的行为边界

## 关键洞察

### 1. 专业化分工
- 50个专业Agent vs 单个通用Agent
- 每个Agent深耕特定领域

### 2. 竞争+协作
- 20+方法相互竞争
- 批判和投票确保质量

### 3. 自我进化
- 研究Agent提出新方法
- 元Agent基于反馈改进系统
- 代码级别的自我重写

### 4. 人类在环
- 投资者从执行者变为监督者
- IPS文档提供高层指导

## 对我们系统的启示

### 架构借鉴
1. **专业化SOUL**: 不同Agent有不同专业化SOUL配置
2. **竞争机制**: 多个Agent提出方案，评估后选择最优
3. **元Agent改进**: 系统基于执行反馈自动优化SOUL
4. **治理文档**: 高层约束与具体执行分离

### 实现思路
```
Task → 分发到多个专业Agent → 并行执行 → 批判评估 → 投票选择 → Meta-Agent学习 → SOUL优化
```

## 标签
#multi-agent #financial-ai #agent-evolution #specialized-agents #meta-learning
