---
HB#: 1559
Title: SSGM记忆治理框架
Paper: Governing Evolving Memory in LLM Agents (arXiv:2603.11768)
Authors: Chingkwun Lam, Jiaxin Li, Lingfei Zhang, Kuo Zhao (Jinan University)
Date: 2026-03-12
Category: Memory Governance / Agent Architecture
---

## 核心贡献

SSGM (Stability and Safety-Governed Memory) 框架——解决动态记忆系统的稳定性-可塑性困境。

## 四大设计原则 (与OpenClaw完全映射)

| SSGM原则 | 机制 | OpenClaw对应 |
|---------|------|-------------|
| **Pre-Consolidation Validation** | Write Validation Gate (TMS) | `read_by`人类审查机制 |
| **Temporal & Provenance Grounding** | Read Filtering Gate + Weibull衰减 | Error Log时序衰减 + AGENTS.md版本控制 |
| **Access-Scoped Retrieval** | ABAC访问控制 | `read_by`强制/禁止标记 |
| **Reversible Reconciliation** | 双轨制：Mutable Graph + Immutable Ledger | Skill (可变) + Error Log (不可变) |

## 关键形式化定理

**Theorem 1 (Bounded Semantic Drift)**: 在无约束系统中，语义漂移随时间T线性增长 O(T·ε)。在SSGM框架下，每N步执行reconciliation，漂移上限为 O(N·ε)，与总时长T无关。

→ 直接验证OpenClaw Error Log定期人类审查的设计。

## 四维失效模式分类学

| 维度 | 失效模式 | 机制 | SSGM防御 |
|-----|---------|------|---------|
| **Stability** | Semantic Drift | 迭代摘要导致信息丢失 | Ground Truth Anchoring |
| | Procedural Drift | 次优工作流固化 | Rule Verification |
| **Validity** | Memory Hallucination | 存储虚构事实 | Consistency Verifier |
| | Temporal Obsolescence | 过时事实冲突 | Weibull Decay Function |
| **Efficiency** | Retrieval Latency | 线性/二次增长 | Hierarchical Indexing |
| **Safety** | Memory Poisoning | 恶意指令注入 | Write Filtering |
| | Privacy Leakage | 跨会话/用户泄漏 | Provenance & ACLs |

## 双轨记忆架构

SSGM明确区分：
- **Mutable Active Graph**: 快速更新的语义记忆 (Skill对应)
- **Immutable Episodic Log**: 追加-only原始记录 (Error Log对应)

→ 与OpenClaw架构完全同构。

## 三大基本权衡 (Fundamental Trade-offs)

1. **Latency-Safety**: 治理层引入System 2验证步骤，增加延迟
2. **Stability-Plasticity**: 严格一致性过滤可能导致知识僵化
3. **Graph Scalability**: 图结构推理能力随规模下降

## 三个可检验研究假设

- H1: 治理门统计上限制漂移幅度
- H2: 访问范围检索降低对抗性泄漏风险
- H3: 延迟与连贯性的权衡

