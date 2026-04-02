# HB#1592 — Structured Distillation for Personalized Agent Memory

**Source**: arXiv:2603.13017 [cs.AI]  
**Authors**: Sydney Lewis (Process Point Technologies)  
**Date**: March 13, 2026  
**Code**: https://github.com/Process-Point-Technologies-Corporation/searchat  

## TL;DR

结构化蒸馏实现**11倍token压缩**（371→38 tokens），最佳纯蒸馏配置保持**96%原始MRR**（0.717 vs 0.745）。关键发现：**向量搜索保持质量，BM25显著退化**。

## 核心方法

### 四字段结构化蒸馏对象 (Palace Objects)

| 字段 | 来源 | 内容 | 类比 |
|-----|------|------|------|
| **exchange_core** | LLM生成 | 完成内容（1-2句） | Commit message |
| **specific_context** | LLM生成 | 区分性技术细节 | The diff |
| **room_assignments** | LLM生成 | 1-3主题房间 | Directory tree |
| **files_touched** | 正则提取 | 文件路径 | Changed files |

### 幸存词汇原则 (Surviving Vocabulary Principle)

- LLM被要求**重用**对话中的具体术语，而非自由改写
- 仅27.0%的高IDF词汇保留，但96.8%的**查询词汇**保留
- `specific_context`携带更高IDF词汇（5.74 vs 3.13，1.84倍比率）

## 实验结果

### 语料统计

| 指标 | 数值 |
|-----|------|
| 总对话数 | 4,182 |
| 总交换数 | 14,340 |
| 蒸馏对象数 | 12,427 |
| 原始平均长度 | 371 tokens |
| 蒸馏后平均长度 | 38 tokens |
| **压缩率** | **11×** |

### 机制依赖性 (Mechanism-Dependent Preservation)

| 机制 | 表现 | 统计显著性 |
|-----|------|-----------|
| **向量搜索** (HNSW/Exact) | 保持 verbatim MRR 96%+ | **不显著** (Bonferroni校正后) |
| **BM25** | 显著退化 | **显著** (|d|=0.031-0.756) |

### 跨层配置性能

**最佳跨层**: BM25(原始文本) + HNSW(蒸馏文本)
- MRR: **0.759** > 纯原始基线0.745
- 信号互补：关键词+语义搜索融合超越单一模式

## 两层架构设计

> "The distilled text is **never shown to the user**. It serves as a **retrieval routing artifact**: all search modes return the original verbatim conversation text. The user **always reads the unmodified original**."

**设计决策**:
1. 蒸馏文本仅用于路由查询（决定哪些对话浮现及排名）
2. 用户始终阅读未修改的原始对话
3. 原始文本保留在本地，可用于钻取

## OpenClaw架构映射

| 论文组件 | OpenClaw等效 | 验证状态 |
|---------|-------------|---------|
| exchange_core | Error Log核心摘要 | ✅ 结构一致 |
| specific_context | Error Log技术细节 | ✅ 同构 |
| room_assignments | AGENTS.md主题分类 | ✅ 完全映射 |
| files_touched | 文件引用追踪 | ✅ 一致 |
| 两层架构(索引vs展示) | Error Log路由→原始记录 | ✅ 设计验证 |

## 内存预算影响

| 场景 | 原始tokens | 蒸馏后tokens | 节省 |
|-----|-----------|-------------|------|
| 500轮对话 | ~185,500 | ~19,000 | **89.7%** |
| 1000轮对话 | ~371,000 | ~38,000 | **89.7%** |

## 设计启示

### 对AGENTS.md
- 结构化字段（Identity/Instructions/Context）比自由文本更高效
- 主题分类（room_assignments）提升检索精度
- 文件引用显式提取（files_touched）增强可追踪性

### 对Error Log
- 结构化蒸馏可用于压缩历史Error Log
- 语义搜索优于关键词匹配
- 保留原始记录用于审计钻取

## 关键引用

> "What is missing is not better summarization but structured extraction: a method that produces indexed, retrievable working memory from the conversation while the ground truth remains locally available."

> "Only 27.0% of the top-15 highest-IDF tokens per verbatim exchange appear in the corresponding distilled text. Most exchange-specific rarities, such as error strings, file paths, and unique identifiers, are lost. But 96.8% of query vocabulary is retained in the distilled corpus."

---

**Archive Date**: 2026-03-16  
**OpenClaw Relevance**: High — Direct architectural validation
