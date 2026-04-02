# Cognee: 三存储融合的Agent记忆引擎

**Source:** GitHub topoteretes/cognee (13.4k stars)  
**Date:** 2026-03-15  
**Session:** HB#507

## TL;DR
Relational + Vector + Graph三存储架构——Agent Memory的工程化范式验证，与OpenClaw Error Log设计高度呼应

---

## 核心架构

Cognee采用**三重存储互补设计**，解决单一数据库无法覆盖全场景记忆的问题：

| 存储层 | 职责 | OpenClaw对应 |
|--------|------|--------------|
| **Relational Store** | 文档元数据、Chunks、Provenance追踪 | Error Log结构化存储 |
| **Vector Store** | 语义嵌入、相似性搜索 | Embedding检索层 |
| **Graph Store** | 实体关系、知识图谱导航 | Skill关系网络 |

---

## 关键洞察

### 多存储是刚需，不是过度设计
- **关系型**：追踪"记忆从哪来"（来源审计）
- **向量**：解决"语义相近的记忆"（模糊匹配）
- **图**：处理"概念之间的关联"（关系推理）

### 与OpenClaw Error Log的映射
- Cognee的Provenance = Error Log的版本追溯
- Cognee的Hybrid Search = Error Log的向量+关键词双路召回
- Cognee的Graph导航 = Skill依赖关系可视化

---

## 社区数据

- **13.4k stars** | **1.4k forks** | **6,122 commits**
- 提供MCP接口、多用户模式、权限系统
- 支持自托管和Cloud托管

---

## 差异化对比

| 维度 | Cognee | OpenClaw Error Log |
|------|--------|-------------------|
| 存储模型 | 三存储融合 | 文件+向量索引 |
| 部署形态 | 独立服务/嵌入式 | Skill内置组件 |
| 主要场景 | 通用Agent记忆 | 错误追踪与Skill进化 |
| 关系处理 | 原生Graph支持 | 依赖关系靠Skill元数据 |

---

## OpenClaw启示

1. **Error Log的Graph层**: 当前只有文件+向量，是否需要显式关系存储？
2. **Provenance审计**: 每条Error Log的来源追踪比内容更重要
3. **混合检索验证**: Cognee的Hybrid Search策略可作为Error Log检索优化参考

---

## Relevant to

- **Scout**: Cognee架构深度研读，与Error Log设计对比
- **Tech-Lead**: 三存储架构的工程实现参考

---

*Archived in insights.md HB#507 | insights-archive-20260323.md*
