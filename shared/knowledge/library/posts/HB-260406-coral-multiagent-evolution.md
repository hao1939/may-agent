---
title: "CORAL: 自主多智能体进化框架"
source: "小红书 / arXiv:2604.01658"
date: 2026-04-06
type: "paper"
topics: ["multi-agent", "evolution", "open-ended-discovery", "swarm-intelligence"]
---

# CORAL: Towards Autonomous Multi-Agent Evolution for Open-Ended Discovery

**论文**: arXiv:2604.01658 (April 2, 2026)  
**作者**: Ao Qu, Han Zheng, Zijian Zhou, et al. (MIT, NUS, Minimax等10个机构)  
**代码**: https://github.com/Human-Agent-Society/CORAL

## 核心思想

CORAL 是第一个用于开放性问题的自主多智能体进化框架，核心创新是**将进化过程的控制权下放给智能体**，取代固定的启发式规则和硬编码探索策略。

## 三大机制

### 1. 共享持久化记忆 (Shared Persistent Memory)
- **attempts/**: 所有尝试的历史记录
- **notes/**: 反思和总结
- **skills/**: 习得的技术和方法
- 构成"信息场"，智能体通过读取感知"哪些方向已拥挤"、"哪些方向尚待探索"

### 2. 异步多智能体组织
- **隔离工作空间**: 每个智能体拥有独立的 git worktree，避免代码冲突
- **间接协作**: 智能体之间不直接通信，通过读写共享内存相互影响
- **异步执行**: 智能体自主决定何时提交评估，无需同步等待

### 3. 心跳式干预 (Heartbeat Interventions)
- **Reflect**: 每次评估后自动反思
- **Consolidate**: 10次评估后整合知识
- **Pivot**: 连续5次无改进后切换方向

## 关键设计原则

| 特性 | 说明 |
|------|------|
| 无人类介入 | 只在开始配置参数 |
| 无中央调度器 | AgentManager只管理生命周期，不分配任务 |
| 自主决策 | 每个智能体基于共享内存独立选择下一步方向 |
| 知识扩散 | 有效技术通过共享内存自然传播 |

## 实验成果

| 任务 | 结果 | 对比 |
|------|------|------|
| Polyominoes Packing | 89.4% 覆盖率 | 超越SOTA 87% |
| Kernel Engineering | 1103 cycles | 从1363降低18.3% |
| 11个任务中的8个 | 刷新SOTA | 改进率3-10倍于固定进化搜索 |
| 评估效率 | - | 提升5-10倍 |

## 对我们的系统的意义

1. **去中心化协调**: 间接协作模式与我们 Bulletin 系统的思路一致
2. **心跳机制**: 我们的 heartbeat.md 设计与 Reflect/Consolidate/Pivot 概念高度契合
3. **共享内存**: attempts/notes/skills 的分层结构与我们的知识库设计相似
4. **异步执行**: 支持我们当前的异步多智能体架构

## 关键引用

> "Greater agent autonomy and multi-agent evolution can substantially improve open-ended discovery."

---

*Source: 小红书@朗读并背诵全文, arXiv:2604.01658*
