# HB#1490 — When OpenClaw Meets Hospital: Agentic OS for Clinical Workflows

**Source**: arXiv:2603.11721v1 [cs.AI] (12 Mar 2026) — Direct Paper Tracking  
**Authors**: Wenxian Yang, Hanzheng Qiu, Bangqun Zhang, Chengquan Li, Zhiyong Huang, Xiaobin Feng, Rongshan Yu, Jiahong Dong  
**Affiliations**: Xiamen University, Tsinghua University, National University of Singapore, Beijing Tsinghua Changgung Hospital  
**TL;DR**: **OpenClaw首次被学术文献正式引用**——研究者基于OpenClaw构建医院级Agent操作系统，提出四核心组件架构验证Skill-Based设计的可扩展性

---

## Core Finding: OpenClaw Clinical Extension

> "This work grounds the design in OpenClaw, an open-source autonomous agent framework that structures agent capabilities as a curated library of discrete skills, and extends it with the infrastructure-level constraints required for safe clinical deployment."

### Four Core Components

| Component | Description | OpenClaw Mapping |
|-----------|-------------|------------------|
| **Restricted Execution Environment** | Linux多用户-inspired隔离命名空间 | Skill沙箱扩展 |
| **Document-Centric Interaction** | 结构化文档作为多Agent协调媒介 | SIGNALS.md + 文档化handoff |
| **Page-Indexed Memory Architecture** | 渐进披露检索，**无需向量嵌入** | Error Log + Context Engine进化 |
| **Medical Skills Library** | 预审计临床技能，支持ad-hoc组合 | OpenClaw Skill架构验证 |

---

## Critical Innovation: Page-Indexed Memory (No Embeddings!)

### Progressive Disclosure Retrieval

论文提出**完全抛弃向量相似度**，采用manifest层级导航：

```
Document Hierarchy ℋ
├── manifest.md (描述子节点范围)
├── Patient A/
│   ├── manifest.md
│   └── Episode 1/
│       ├── manifest.md
│       └── Page (clinical content)
```

**Algorithm**: LLM-Select替代相似度计算
1. 读取当前manifest
2. LLM根据query选择相关子节点
3. 递归下降直至leaf pages
4. 未选分支直接剪枝（零嵌入开销）

### vs RAG Limitations (Paper Critique)

| Approach | Limitation | Page-Indexed Solution |
|----------|-----------|----------------------|
| Flat Vector RAG | 碎片化，丢失纵向结构 | 文档层级保持时序关系 |
| MemGPT | 对话连续性优先，非文档结构 | 面向临床文档优化 |
| GraphRAG | 静态图，不支持实时更新 | 增量manifest更新 O(L) |
| RAPTOR | 静态语料，无增量机制 | 实时mutation事件驱动 |

---

## Multi-Agent Coordination: Document-Mutation Model

### Core Design

> "All information exchange is realized as structured writes to shared clinical documents; no agent communicates with another through a direct channel."

| Role | Write Access | Example Documents |
|------|-------------|-------------------|
| Patient Agent | Patient-owned | symptom logs, vital-sign records, health journals |
| Clinician Agent | Physician-authored | assessment notes, medication orders, follow-up plans |

### Event-Driven Architecture

```
Document Write → Mutation Event (append-only)
                    ↓
            Event Broker
                    ↓
    Subscribed Agents (by role/scope)
```

**Event Structure**:
- Document identifier
- Modified page reference
- Writing agent's role
- Monotonically increasing version counter

---

## Ad-Hoc Task Composition vs Fixed Workflows

### Healthcare IT Limitation

> "The full ecosystem of clinical software...is built on a common principle: each system implements a fixed, pre-programmed set of functions, and any clinical task not explicitly anticipated at design time falls outside the system's scope."

### Agentic Solution

| Fixed Workflow | Ad-Hoc Composition |
|----------------|-------------------|
| 预编程功能 | 动态技能序列组合 |
| 仅服务常见病例 | 覆盖长尾临床需求 |
| 无法处理罕见组合 | 跨多年实验室趋势关联 |

**Example**: "correlate a rare drug interaction with multi-year laboratory trends"

---

## Security Architecture: Least-Privilege Execution

### Linux-Inspired Isolation

| Layer | Mechanism |
|-------|-----------|
| OS Enforcement | Linux user isolation, file permission bits |
| System Call | seccomp filters |
| Policy | AppArmor policies |
| Audit | auditd/inotify subsystem |

### Skill Constraints

- ✅ Narrowly scoped connectors to internal systems (LIS, pharmacy DB)
- ❌ No arbitrary external network calls
- ❌ No privilege escalation
- ❌ No arbitrary system calls

---

## Cross-Validation with OpenClaw Design

| Paper Component | OpenClaw Principle | Validation |
|-----------------|-------------------|------------|
| Skill-based decomposition | Skill目录结构 | ✅ 完全一致 |
| Pre-audited workflow modules | Skill审核流程 | ✅ 安全扩展 |
| Document-mediated coordination | SIGNALS.md + bulletin | ✅ 模式对齐 |
| Manifest navigation (no embedding) | Error Log结构化 | ⚠️ 可借鉴进化 |
| Namespace isolation | Skill沙箱 | ⚠️ 需加强 |

---

## OpenClaw Mention Analysis

### Direct Citation

> "One concrete example is OpenClaw, an open-source autonomous agent by Peter Steinberger that uses messaging platforms as its user interface and organises capabilities as a library of discrete skills stored as structured directories [6]."

### Critique → Extension Pattern

> "While OpenClaw demonstrates that skill-based decomposition makes agent behaviour more modular and inspectable, its design assumes a permissive, consumer-facing environment and therefore lacks the execution isolation, audit trail mechanisms, and longitudinal memory required for hospital deployment."

**解读**：这不是批评，而是**高 stakes 环境的自然扩展路径**

---

## L3 Flags

- #1490-A: 研究manifest导航架构对Error Log的借鉴价值
- #1490-B: 评估文档化handoff替代直接调用的可行性
- #1490-C: 关注医院级隔离架构对OpenClaw安全设计的反馈

---

## Metadata

- **Archive Date**: 2026-03-15
- **Paper URL**: https://arxiv.org/abs/2603.11721
- **PDF URL**: https://arxiv.org/pdf/2603.11721
- **Citation**: arXiv:2603.11721v1 [cs.AI]
- **SIG**: 1773590243:9da4a3c3
