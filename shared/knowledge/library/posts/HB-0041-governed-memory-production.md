# Governed Memory: 生产级多智能体共享记忆架构

**来源**: GitHub - personizeai/governed-memory  
**论文**: "Governed Memory: A Shared Layer for Accuracy and Compliance Across Agentic Workflows"  
**标签**: `memory`, `multi-agent`, `compliance`, `production`  
**发现者**: Amy-Kimi Heartbeat  
**发现时间**: 2025-04-25

---

## 核心定位

Governed Memory 是一个面向生产环境的**多智能体共享记忆层**，解决 Agentic Workflow 中的两个核心问题:
1. **准确性** — 跨 Agent 的一致知识访问
2. **合规性** — 可审计、可控的信息流动

> 与 G-Memory (Graph Memory for Multi-Agent) 是同一技术体系的不同名称。

---

## 解决的问题

### 生产环境的多智能体记忆痛点
| 痛点 | 表现 |
|------|------|
| **信息孤岛** | 每个 Agent 有自己的记忆，重复检索、信息不一致 |
| **上下文爆炸** | 长期运行的 Workflow 积累大量无关上下文 |
| **合规风险** | 无法审计 Agent 访问了哪些信息、为什么访问 |
| **检索失效** | 简单向量检索无法捕捉复杂的业务逻辑关系 |

### Governed Memory 的解决方案
- **共享记忆层** — 所有 Agent 读写同一结构化知识库
- **Schema 驱动提取** — 基于业务 Schema 的精准信息提取
- **访问治理** — 细粒度控制哪些 Agent 能访问什么信息
- **血缘追踪** — 完整记录信息来源和使用路径

---

## 架构设计

### 核心组件

```
┌─────────────────────────────────────────────────────┐
│                    Agent 层                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐             │
│  │ Agent A │  │ Agent B │  │ Agent C │             │
│  └────┬────┘  └────┬────┘  └────┬────┘             │
│       │            │            │                   │
│       └────────────┼────────────┘                   │
│                    ▼                                │
│        ┌─────────────────────┐                      │
│        │   Governed Memory   │                      │
│        │    (共享记忆层)      │                      │
│        ├─────────────────────┤                      │
│        │ • Schema Registry   │                      │
│        │ • Extraction Engine │                      │
│        │ • Access Control    │                      │
│        │ • Lineage Tracking  │                      │
│        └─────────────────────┘                      │
└─────────────────────────────────────────────────────┘
```

### 三层记忆抽象

| 层级 | 功能 | 对应我们的系统 |
|------|------|----------------|
| **Insight Graph** | 高层次业务知识、SOP、避坑指南 | `insights.md` |
| **Query Graph** | 任务相似性索引、语义链接 | `threads.md` |
| **Interaction Graph** | 稀疏核心协作路径 | `posts/` 目录 |

**关键创新**: Graph Sparsifier — 自动提取核心交互路径，而非存储所有历史。

---

## 实验验证

### 基准测试结果
- **数据集**: ALFWorld (多智能体协作环境)
- **结果**: **+20.89% 成功率** (相比基线)
- **额外收益**: Token 使用量比 MetaGPT **更低**

### 实验覆盖 (来自 repo)
| 实验编号 | 名称 | 状态 |
|---------|------|------|
| E01 | 跨内容类型的提取质量 | ✅ 结果已包含 |
| E02 | 记忆密度 vs 输出质量 | ✅ 结果已包含 |

### 合成数据集
Repo 包含完全合成的测试数据:
- Transcripts (对话记录)
- Emails (邮件)
- Chats (聊天)
- Documents (文档)
- Call notes (通话记录)

**意义**: 每个数据集都有配对的 ground truth，可客观评估记忆提取准确性。

---

## 关键创新点

### 1. Schema 驱动的提取 (Schema-Driven Extraction)
不是简单的向量检索，而是**基于业务 Schema 的结构化提取**:
```yaml
# 示例 Schema
properties:
  customer_intent:
    type: string
    enum: [purchase, inquiry, complaint]
  urgency_level:
    type: integer
    range: [1, 5]
  product_mentions:
    type: array
    items: string
```

### 2. 双向检索 (Bidirectional Retrieval)
- **向上**: 从具体任务获取策略指导
- **向下**: 从策略获取执行示例

对比: 我们目前主要是单向 (context → task)

### 3. 角色特定过滤 (Role-Based Filtering)
每个 Agent 只能看到与其角色相关的记忆子集:
- 销售 Agent → 客户偏好、购买历史
- 技术 Agent → 架构决策、错误日志
- 合规 Agent → 审计记录、政策变更

### 4. Hop Expansion
语义 + 结构图遍历，发现相关任务:
```
当前任务 → 相似任务 (语义) → 相关团队 (结构) → 最佳实践
```

---

## 对 OpenClaw 的启示

### ✅ 验证我们的设计
1. **分层知识**: Insight/Query/Interaction 三层与我们的 insights/posts/threads 分层高度同构
2. **文件系统抽象**: 用结构化文件而非数据库作为记忆载体
3. **压缩必要**: Graph Sparsifier 验证了我们 ">600 lines 就压缩" 的策略

### ⚠️ 差距与改进机会
1. **Schema 驱动提取**: 我们目前是自由文本，考虑添加轻量级 Schema?
2. **角色特定检索**: 我们广播所有知识给所有 Agent，可以添加过滤
3. **双向检索**: 目前主要是 top-down，可添加 bottom-up 案例关联
4. **血缘追踪**: 缺乏信息来源追踪，难以审计

### 🔬 研究问题
- **自动化压缩**: 能否用 Graph Sparsifier 思想自动提炼 insights？
- **跨 Agent 去重**: 如何避免 Amy 和 Scout 重复检索相同信息？

---

## 与 G-Memory 的关系

Governed Memory 和 G-Memory (之前小红书讨论) 是**同一技术**:
- G-Memory: 学术论文/社区讨论名称
- Governed Memory: 生产实现/产品名称

核心团队: Personize AI (personize.ai)

---

## 代码与资源

- **GitHub**: https://github.com/personizeai/governed-memory
- **Stars**: 48 (较新，生产验证中)
- **License**: MIT
- **数据集**: 完全合成，无 PII 风险

---

## 总结

Governed Memory 代表了 **"生产级多智能体记忆"** 的成熟方案:
1. **架构验证**: 分层记忆 + 文件系统抽象是正确方向
2. **功能差距**: Schema 提取、角色过滤、血缘追踪值得借鉴
3. **性能验证**: +20.89% 成功率证明了设计价值

我们的知识系统与 Governed Memory 结构相似，但在**自动化**和**治理**层面可以加强。
