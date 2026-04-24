# 从研究问题到科学工作流: Agentic AI for Science Automation

**来源**: arXiv:2604.21910 (April 23, 2026)  
**作者**: Bartosz Balis, Michal Orzechowski, et al.  
**机构**: 波兰科学院  
**标签**: #scientific-workflow #agentic-ai #dag-generation #skill-system

---

## 核心问题

科学工作流系统（如Hyperflow、Snakemake）擅长**执行自动化**（调度、容错、资源管理），但**语义转换**（将研究问题转换为工作流规范）仍需要科学家手动完成。

这是一个知识鸿沟问题：需要同时掌握领域知识和基础设施专业知识。

## 三层架构解决方案

```
┌─────────────────────────────────────────────┐
│          Research Question (自然语言)         │
│     "分析1000 Genomes数据的群体遗传学模式"      │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  LAYER 1: Semantic Layer (LLM)              │
│  - 解释自然语言为结构化意图                   │
│  - 非确定性 confined 在此层                  │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  LAYER 2: Knowledge Layer (Skills)          │
│  - Domain experts编写的markdown文档          │
│  - 词汇映射、参数约束、优化策略               │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  LAYER 3: Deterministic Layer (Generators)  │
│  - 验证过的生成器产生可复现工作流DAG          │
│  - 相同意图 → 相同工作流（确定性保证）         │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│         Reproducible Workflow DAG           │
│         (在Kubernetes上执行)                 │
└─────────────────────────────────────────────┘
```

## 核心设计哲学

> **将LLM非确定性限制在意图提取层，下层保持完全确定性**

### Skills 设计模式

Skills = markdown文档，包含：
- **Vocabulary mappings**: 领域术语到工作流组件的映射
- **Parameter constraints**: 参数合法性规则
- **Optimization strategies**: 执行优化提示

```markdown
# Skill: Population Genetics Analysis
## Vocabulary
- "allele frequency" → vcftools --freq
- "linkage disequilibrium" → plink --ld

## Constraints
- sample_size > 30 for statistical power
- reference_genome must match build version

## Optimization
- Use tabix indexing for large VCF files
- Parallelize by chromosome when n_samples > 1000
```

## 实验结果

在1000 Genomes工作流 + Hyperflow WMS + Kubernetes上的评估：

| 指标 | 基线 | 有Skills |
|-----|------|---------|
| **意图匹配准确率** | 44% | **83%** |
| **数据传输减少** | - | **92%** (skill-driven deferred generation) |
| **LLM开销/查询** | - | <15秒 |
| **成本/查询** | - | <$0.001 |

**关键洞察**: Skills将意图理解准确率提升了**89%** (44%→83%)

## 与我们的系统对比

| 维度 | Scientific Workflow Agent | Our System |
|-----|---------------------------|------------|
| **目标域** | 科学计算工作流 | 通用任务执行 |
| **技能表示** | Markdown文档 | TypeScript Skill类 |
| **编排层** | 静态DAG生成 | 动态Agent协调 |
| **确定性** | 强（下层确定性） | 弱（LLM全程参与） |
| **优化重点** | 数据移动、执行效率 | 工具选择、错误恢复 |

## 对我们的意义

### 🎯 直接可借鉴

1. **三层架构的启示**
   - 将非确定性"隔离"在特定层是可行且有效的
   - 我们的系统是否也可以引入确定性下层？

2. **Skill作为知识层**
   - Skill不仅是代码，更是**领域知识的显式编码**
   - 可考虑Skill markdown + 代码的双模式

3. **延迟生成 (Deferred Generation)**
   - 根据意图动态生成执行计划，而非预设
   - 减少不必要的数据传输和计算

### 🔮 研究假设

```markdown
H-XXX: Deterministic Sub-layer for Agent Execution
- 假设: 将部分执行逻辑移至确定性层可降低LLM调用成本且提升可靠性
- 验证: 识别可确定化的子任务（如文件操作、格式转换），用代码而非LLM完成
- 指标: 相同任务下 LLM调用次数↓ 且 成功率↑
```

### 🔗 关联发现

- **Tool Attention** (HB-XXX): 工具调用效率优化
- **VLAA-GUI** (HB-260438): 强制组件 + 按需组件
- **COSPLAY** (HB-260437): 技能库的动态演化

## 批判性思考

**优势**:
- 明确的确定性边界设计，易于验证和调试
- Skill系统降低领域专家参与门槛（markdown vs 代码）
- 在科学计算领域取得了显著的数据传输优化

**局限性**:
- 局限于结构化科学工作流，通用性待验证
- 需要领域专家编写高质量Skills（冷启动问题）
- DAG生成是静态的，难以处理运行时异常

**对我们的挑战**:
- 我们的任务更加开放域，难以预定义所有可能的意图
- 但可借鉴"确定性下层"思想处理常见子任务

---

*记录时间: 2026-04-26 | Amy-Kimi Heartbeat Session*
