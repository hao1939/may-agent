# Structured Distillation for Personalized Agent Memory

**Source**: arXiv:2603.13017v1 [cs.CL]  
**Published**: 2026-03-13  
**Authors**: (from arXiv API)  
**HB ID**: #1701

---

## TL;DR
结构化蒸馏实现Agent记忆11倍压缩（371→38 tokens），保持96%检索质量。四字段复合对象设计（exchange_core, specific_context, thematic room_assignments, files_touched）与OpenClaw分层架构高度同构。

---

## Core Innovation

### 问题定义
- 长对话历史有用但逐字携带成本高昂
- 个性化Agent记忆：将用户对话历史蒸馏为紧凑检索层

### 四字段复合对象结构
```
exchange_core          # 核心交换内容
specific_context       # 特定上下文
thematic room_assignments  # 主题分类
files_touched          # 正则提取的触及文件
```

### 关键指标
| 指标 | 数值 | 意义 |
|------|------|------|
| 压缩率 | **11×** | 371 → 38 tokens/交换 |
| 检索质量保持 | **96%** | MRR 0.717 vs 0.745 (逐字基线) |
| 最佳跨层配置 | **>100%** | MRR 0.759 (超越逐字基线) |

---

## Experimental Validation

### 数据集规模
- 4,182 段对话
- 14,340 次交换
- 6 个软件工程项目

### 评估方法
- 201 个召回导向查询
- 107 种配置（5种纯模式 + 5种跨层模式）
- 5个LLM评分器
- 214,519 个共识评分查询-结果对

### 关键发现
- **向量搜索**：20种配置经Bonferroni校正后均无显著退化
- **BM25搜索**：所有20种配置显著退化（效应量|d|=0.031-0.756）
- **机制依赖性**：压缩效果取决于检索机制

---

## OpenClaw Relevance

### 结构同构映射
| 论文概念 | OpenClaw对应 |
|----------|--------------|
| exchange_core | Error Log核心条目 |
| specific_context | AGENTS.md层级上下文 |
| thematic room_assignments | Domain/Sub-domain分类 |
| files_touched | 文件系统操作记录 |

### 设计验证
1. **分层压缩策略** ↔ OpenClaw分层职责分离
2. **向量保留+摘要提取** ↔ 被动语境扩展模式
3. **跨层检索超越纯逐字** ↔ AGENTS.md + Skills协同效应

### 战略启示
- Error Log可应用类似结构化压缩，11倍减少上下文占用
- 对话历史不必逐字保留，结构化蒸馏即可维持96%效用
- " verbatim source remains available for drill-down" — 与OpenClaw只读溯源原则一致

---

## Citation
```bibtex
@article{structured-distillation-memory-2026,
  title={Structured Distillation for Personalized Agent Memory: 11x Token Reduction with Retrieval Preservation},
  journal={arXiv preprint arXiv:2603.13017},
  year={2026}
}
```

---

**Discovery Date**: 2026-03-16  
**Agent**: Amy-Kimi  
**Status**: 🔥🔥🔥🔥🔥 Milestone — Direct validation of OpenClaw compression principles
