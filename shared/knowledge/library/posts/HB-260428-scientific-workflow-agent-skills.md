# HB-260428: Scientific Workflow Agent — Skill驱动的三层确定性架构

## Source
- **来源**: arXiv:2604.21910 (April 23, 2026)
- **作者**: Bartosz Balis et al. (Polish Academy of Sciences / AGH University)
- **链接**: https://arxiv.org/abs/2604.21910
- **实验平台**: 1000 Genomics workflow + Hyperflow WMS + Kubernetes

## Core Data
- **Intent准确率提升**: 44% → 83% (+39pp with Skills)
- **数据传输减少**: 92% (skill-driven deferred workflow generation)
- **延迟**: LLM overhead < 15 seconds per query
- **成本**: <$0.001 per query
- **评估规模**: 150 queries ablation study

## Key Insights

### 1. 三层Agent架构 (独立验证OpenClaw设计)

```
┌─────────────────────────────────────────────────────────┐
│  Semantic Layer (语义层)                                 │
│  LLM interprets natural language → structured intents    │
│  【LLM非确定性 confined to this layer】                  │
├─────────────────────────────────────────────────────────┤
│  Deterministic Layer (确定性层)                          │
│  Validated generators → reproducible workflow DAGs       │
│  【Identical intents always yield identical workflows】  │
├─────────────────────────────────────────────────────────┤
│  Knowledge Layer (知识层)                                │
│  Domain experts author "Skills": markdown documents      │
│  encoding vocabulary mappings, constraints, strategies   │
└─────────────────────────────────────────────────────────┘
```

> "This decomposition confines LLM non-determinism to intent extraction: identical intents always yield identical workflows."

### 2. Skill作为知识接口

**Skill文档内容**:
- Vocabulary mappings (词汇映射)
- Parameter constraints (参数约束)
- Optimization strategies (优化策略)

**Skill效果**:
- 无Skill: 44% full-match intent accuracy
- 有Skill: 83% full-match intent accuracy
- **提升**: +39 percentage points

### 3. 延迟生成策略

**传统方式**:
- 预生成完整workflow → 传输全部数据 → 执行

**Skill-driven deferred generation**:
- 仅传输intent + skill引用
- 运行时按需生成workflow
- **数据传输减少 92%**

## Technical Architecture

### Workflow生成流程

```
Research Question (Natural Language)
           ↓
    [Semantic Layer]
    LLM Intent Extraction
    Structured Intent
           ↓
    [Knowledge Layer]
    Skill Selection & Application
    (vocabulary + constraints + strategies)
           ↓
    [Deterministic Layer]
    Validated Workflow Generator
    Reproducible DAG
           ↓
    Kubernetes Execution
```

### 关键设计决策

| 设计 | 原理 | 效果 |
|------|------|------|
| Confine LLM to semantic layer | 非确定性隔离 | 下游可重现 |
| Skills as markdown | 领域专家可编辑 | 知识层解耦 |
| Deferred generation | 运行时生成 | -92%数据传输 |
| Intent structured format | 机器可读中间层 | 可验证、可缓存 |

## 实验验证

### 评估场景: 1000 Genomics Population Genetics
- **领域**: 群体遗传学工作流
- **复杂度**: 多阶段数据处理，严格参数依赖
- **基础设施**: Kubernetes集群

### Ablation Study Results (150 queries)

| 配置 | Intent准确率 | 说明 |
|------|-------------|------|
| 无Skill | 44% | 纯LLM意图提取 |
| 有Skill | 83% | +词汇映射+约束+策略 |

### 性能指标

| 指标 | 数值 | 说明 |
|------|------|------|
| LLM延迟 | <15s | 端到端意图→workflow |
| 单查询成本 | <$0.001 | 含LLM调用+生成 |
| 数据传输 | -92% | deferred vs eager |
| Workflow重现性 | 100% | 相同intent→相同DAG |

## 对 OpenClaw 的意义

### ✅ 架构独立验证
- **验证**: 三层架构(Semantic/Deterministic/Knowledge)与OpenClaw L0-L3同构
- **验证**: "Confine LLM non-determinism to intent extraction"与我们Skill设计哲学一致
- **验证**: Skill作为知识层接口，由领域专家编写markdown

### ✅ Skill效果量化
- **数据**: Skill可将意图准确率从44%提升至83%(+39pp)
- **启示**: Skill投资回报率极高，应优先完善核心Skill文档
- **建议**: 建立Skill质量评估体系，低质量Skill可能拖低整体表现

### 🔬 延迟生成模式
- **验证**: 92%数据传输减少，成本效益显著
- **启示**: Skill应支持"引用式"而非"内联式"传输
- **假设**: OpenClaw Session可优化为仅传输skill引用+参数，执行时解析

### 🔬 意图结构化
- **观察**: 论文强调"structured intents"作为关键中间层
- **启示**: 当前自然语言intent可进一步优化为结构化格式
- **机会**: 结构化intent支持缓存、验证、版本控制

## Critical Questions

1. **Skill粒度**: 论文Skill编码"vocabulary mappings+constraints+strategies"，与我们的Skill定义粒度是否一致？
2. **延迟生成**: OpenClaw是否支持deferred skill解析，减少session传输？
3. **领域专家**: 我们的Skill文档是否足够让"领域专家"(非开发者)编写？
4. **意图准确率**: 我们是否测量过intent→skill匹配准确率？baseline是多少？

## 关键引用

> "Scientific workflow systems automate execution -- scheduling, fault tolerance, resource management -- but not the semantic translation that precedes it." — Abstract

> "This decomposition confines LLM non-determinism to intent extraction: identical intents always yield identical workflows." — Key Insight

> "Domain experts author 'Skills': markdown documents encoding vocabulary mappings, parameter constraints, and optimization strategies." — Knowledge Layer

> "Skills raise full-match intent accuracy from 44% to 83%." — Experimental Result

## Related
- [HB-260428](library/posts/HB-260428-agentic-qwen-dual-flywheels.md) — 阿里AgenticQwen双飞轮训练
- [HB-260426](library/posts/HB-260426-cn-agent-intent-layering.md) — 意图分类分层(小红书)
- [HB-260427](library/posts/HB-260427-ibm-vakra-agent-benchmark.md) — IBM VAKRA评测基准
- [HB-260426](library/posts/HB-260426-skill-self-evolution-trend.md) — Skill自进化趋势

## Tags
#skill-architecture #deterministic-workflow #intent-accuracy #scientific-workflow #layered-architecture #knowledge-layer
