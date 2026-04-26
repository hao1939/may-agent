# HB-2171: Scientific Workflow Agentic AI — 三层架构独立验证

**Source**: arXiv:2604.21910 | AGH University of Krakow, Sano Centre for Computational Medicine  
**Authors**: Bartosz Balis, Michal Orzechowski, Piotr Kica, Michal Dygas, Michal Kuszewski  
**Date**: April 23, 2026  
**Archived**: 2026-04-26 by Amy-Kimi  
**Importance**: 🔥🔥🔥🔥🔥 **架构级独立验证**

---

## Core Contribution

论文提出从研究问题到科学工作流的Agentic AI自动化方案，采用**三层分解架构**将LLM非确定性限制在意图提取层，同时保证相同意图产生相同工作流。

> "Scientific workflow systems automate execution – scheduling, fault tolerance, resource management – but not the semantic translation that precedes it."

---

## Three-Layer Architecture (与OpenClaw高度同构)

| 层级 | 功能 | 实现 | OpenClaw映射 |
|------|------|------|--------------|
| **Semantic Layer** | LLM解释自然语言为结构化意图 | 参数集捕获请求 | L0意图理解 |
| **Deterministic Layer** | 验证生成器产生可复现DAG | 确定性代码生成 | L1/L2执行编排 |
| **Knowledge Layer** | 领域专家编写Skills | Markdown文档 | SKILL.md |

### 关键设计原则

**LLM非确定性隔离**: 将LLM限制在"意图提取"，工作流生成完全确定性 —— 相同意图→相同工作流。

> "This decomposition confines LLM non-determinism to intent extraction: identical intents always yield identical workflows."

---

## Skills设计: Markdown作为知识载体

Skills是**领域专家编写的Markdown文档**，编码：
- **词汇映射** (如 "European" → EUR)
- **参数约束** (如可用vCPU、任务大小)
- **优化策略** (如选择性数据提取)

### Skills vs Few-Shot Prompting

| 维度 | Skills | Few-Shot Prompting |
|------|--------|-------------------|
| **持久性** | 版本控制、可审计 | 临时注入、单次有效 |
| **维护** | 领域专家直接编辑 | 需ML工程师调整 |
| **发现性** | 文件系统组织 | 隐含在prompt中 |
| **复用** | 跨查询共享 | 每查询重复注入 |

> "Skills encode the same kind of domain knowledge as persistent, version-controlled documents that any invocation can consult."

---

## 性能结果: Skills效果量化

### 150查询消融研究 (1000 Genomics工作流)

| 指标 | 基线 | +Skills | 提升 |
|------|------|---------|------|
| **意图准确率** | 44% | **83%** | **+39pp** |
| **数据传输** | 基准 | **-92%** | 延迟加载优化 |
| **LLM延迟** | - | <15秒 | 每次查询 |
| **成本** | - | <$0.001 | 每次查询 |

### Skill驱动优化效果

- **延迟工作流生成**: 按需生成减少不必要数据传输
- **执行时优化**: Skills编码运行时策略(如选择性提取)

---

## Four-Agent Pipeline

论文实现完整的端到端流程：

```
Conductor (指挥) 
    ↓ 验证意图
Workflow Composer (工作流作曲)
    ↓ 生成DAG
Deployment Service (部署服务) 
    ↓ 人体验证
Execution Sentinel (执行哨兵)
    ↓ 监控执行
Kubernetes
```

**Human-in-the-Loop**: 在资源配置和执行前强制人工验证门。

---

## OpenClaw映射验证

| 论文组件 | OpenClaw等价物 | 一致性 |
|----------|---------------|--------|
| Semantic Layer | L0意图理解 | ✅ 同构 |
| Deterministic Layer | L1/L2编排 | ✅ 同构 |
| Knowledge Layer (Skills) | SKILL.md | ✅ 完全一致 |
| Conductor Agent | Main Agent | ✅ 功能对齐 |
| Human Validation Gates | `read_by`机制 | ✅ 设计一致 |
| Deferred Generation | 按需Skill加载 | ✅ 优化方向一致 |

### 关键洞察

1. **Skills作为知识层被独立发现**: 不同团队(AI科学工作流/软件工程Agent) converging on Markdown-based Skills

2. **三层架构的行业共识**: 语义层(非确定性)与确定性层分离是可靠Agent系统的共同模式

3. **延迟加载的量化收益**: 92%数据传输减少验证按需生成策略的价值

4. **专家可编辑性**: Skills由领域专家(非ML工程师)维护是规模化关键

---

## 与相关工作的对比

### vs LLM直接生成工作流

Yildiz & Peterka: "Zero-shot性能差；few-shot prompting将准确率从30%提升至80%，但跨平台翻译仍不可靠。"

Alam & Roy: "GPT-4o达到93%结构准确率 — 但没有生成的工作流能不经人工修正直接执行。"

**本文方案**: Skills将知识外化为持久文档，任何调用都可查阅，而非每次重新注入。

### vs Strickland et al. 的Schema-Gated Orchestration

相似之处: 分离"对话权威"(LLM解释意图)与"执行权威"(验证模式)。

本文差异: 
- 不采用事后验证，而是限制LLM仅产生结构化意图
- 工作流生成委托给确定性代码
- **关键新增**: Knowledge Layer (Skills) 作为可审计的专家文档

---

## Critical Questions for OpenClaw

1. **Skill质量评估**: 如何量化单个Skill对意图准确率的贡献？
2. **延迟加载策略**: 是否实现按需加载Skill内容以减少Session数据传输？
3. **专家编辑体验**: 领域专家能否直接维护SKILL.md而不需理解Agent系统？
4. **意图结构化**: L0输出是否应标准化为结构化意图(而非自由文本)？
5. **验证门位置**: 关键操作前是否有足够的人工验证点？

---

## L3 FLAGS

| ID | Flag | Priority |
|----|------|----------|
| #901 | Skill意图准确率量化: 基线测量+Skill改进对比 | P1 |
| #902 | 延迟Skill加载: 按需加载减少Session开销 | P2 |
| #903 | 意图结构化输出: L0产生标准化意图对象 | P2 |
| #904 | 专家编辑友好性: SKILL.md模板与文档 | P3 |

---

**Relevant to**: Bob (架构验证), May (Skill系统设计), tech-lead (性能优化)

**Paper Links**: 
- arXiv: https://arxiv.org/abs/2604.21910
- PDF: https://arxiv.org/pdf/2604.21910

---

*Archived: 2026-04-26 by Amy-Kimi*  
*ID: HB-2171*
