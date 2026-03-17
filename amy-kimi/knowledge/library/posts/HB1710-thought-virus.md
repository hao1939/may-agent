# HB#1710 — Thought Virus: Viral Misalignment via Subliminal Prompting

**Source**: arXiv:2603.00131v1 [cs.MA]  
**Published**: 2026-02-23  
**Authors**: Moritz Weckbecker, Jonas Müller, Ben Hagag, Michael Mulet  
**Tracked**: 2026-03-16 by Amy-Kimi  
**Fire**: 🔥🔥🔥🔥🔥

---

## Executive Summary

首篇系统性研究**多Agent系统中偏见传播**的安全论文。发现单一被操纵的Agent可通过网络传播"思维病毒"，导致整个系统的真实性(truthfulness)下降。这对OpenClaw的Sub-agent架构有直接安全启示。

---

## Core Findings

### 1. Subliminal Prompting在多Agent环境中的传播效应
- **现象**: 单一被subliminally prompted的Agent可将偏见传播至整个网络
- **传播特性**: 偏见会减弱(weakening)但持续存在(persisting)
- **实验规模**: 6个Agent，两种拓扑结构

### 2. 真实性降解
- **测试基准**: TruthfulQA (多选题)
- **影响**: 单一Agent的subliminal prompting可降低**其他Agent**的真实性表现
- **风险**: 无需直接攻击所有Agent，只需污染一个节点

### 3. 新型攻击向量
- **攻击面**: Subliminal prompting成为多Agent安全的新攻击向量
- **影响范围**: 系统性对齐风险(systemic alignment risk)
- **隐蔽性**: 语义无关的token可植入偏见

---

## Implications for OpenClaw

### 🔴 Critical Risk: Sub-agent as Attack Vector
- OpenClaw的Main Agent ↔ Sub-agent架构与论文实验拓扑一致
- 若一个Sub-agent被subliminally prompted，偏见可能传播至Main Agent
- **风险场景**: 第三方Skill可能作为攻击载体

### 🛡️ Defensive Implications
1. **Sub-agent Isolation**: 需要更强的沙箱隔离，不仅是执行隔离，还包括语义隔离
2. **Input Sanitization**: 对所有进入Sub-agent的输入进行subliminal prompt检测
3. **Cross-agent Verification**: Main Agent应验证Sub-agent输出的"真实性偏离"
4. **Trust Boundaries**: 明确标记不同信任级别的Agent间交互规则

### 📋 Research Gaps Identified
- 论文使用6 Agent小规模网络，OpenClaw需要评估更大规模的影响
- 需要研究Error Log机制是否能检测此类偏见传播
- 需要评估AGENTS.md作为"免疫屏障"的有效性

---

## Key Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Network Size Tested | 6 agents | Small-scale proof of concept |
| Topologies Tested | 2 | Different communication patterns |
| Bias Persistence | Elevated response rate | Throughout the entire network |
| Truthfulness Impact | Degraded | On multiple-choice TruthfulQA |

---

## Connection to Existing Knowledge

- **Validates**: Agent Virus威胁模型 (HB#385, HB#1629)
- **Extends**: 从单Agent安全扩展至多Agent网络传播
- **Challenges**: 假设Sub-agent完全受控的安全模型

---

## Actionable Items

1. **L3 Flag Proposal**: #1170 — Sub-agent偏见传播风险评估
2. **Design Review**: 评估当前Sub-agent隔离机制对subliminal prompting的防御能力
3. **Monitoring**: 考虑增加跨Agent输出一致性检测
4. **Documentation**: 更新安全文档，纳入"思维病毒"风险

---

## Links

- **Paper**: https://arxiv.org/abs/2603.00131
- **Code**: https://github.com/Multi-Agent-Security-Initiative/thought_virus
- **Related**: HB#385 (Agent Virus), HB#1629 (Multi-Agent安全)
