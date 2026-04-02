# HB#1531 — DIVE: Scaling Diversity in Agentic Task Synthesis

**Source**: arXiv:2603.11076 [cs.AI] (Fudan University / MiniMax) — Direct Paper Tracking  
**Date**: 2026-03-15  
**TL;DR**: **Evidence-first任务合成**——先执行真实工具再反向推导任务，确保可验证性；多样性扩展持续优于数量扩展（4倍数据优势）；373工具跨5领域验证

---

## Core Finding: Evidence-First Synthesis

传统方法的问题：
- **Query-first合成**: 先生成查询再验证 → 大量不可解任务
- **固定工具集**: 局限于narrow task family → 泛化能力差
- **模拟工具**: LLM模拟工具执行 → 验证不可靠

**DIVE创新**: Invert the synthesis order
```
传统: Query → Check Validity → Execute (post-hoc验证)
DIVE:  Execute Real Tools → Collect Evidence → Derive Task (grounding by construction)
```

> "We propose DIVE, an evidence-driven recipe that inverts synthesis order, executing diverse, real-world tools first and reverse-deriving tasks strictly entailed by the resulting traces, thereby providing grounding by construction."

---

## Three-Pool Resource Architecture

| Pool | Purpose | Content |
|------|---------|---------|
| **Tool Pool** | Broad Action Space | 373 validated tools (Retrieval + Processing primitives) |
| **Seed Pool** | Semantic Anchors | ~5,000 entity seeds per domain (Wikipedia/PubMed/NCBI/Stock) |
| **Exemplar Pool** | Structural Priors | Query-only exemplars with implicit tool-use patterns |

**关键洞察**: Decoupling enables exponential diversity through recombination.

---

## Two-Stage Synthesis Loop

### Stage 1: Evidence Collection
```
Context: (Query_{k-1}, Evidence_{k-1}, Toolset)
↓
Evidence Collector Agent executes real tools
↓
Accumulate validated (action, observation) pairs
```

### Stage 2: Task Derivation  
```
Context: (Query_{k-1}, Evidence_k, Exemplars)
↓
Task Generator derives (Query_k, Answer_k)
↓
Strictly entailed by execution traces
```

**Grounding by Construction**:
- ✅ **Executable**: 来自真实工具执行
- ✅ **Verifiable**: 可观察输出作为参考答案
- ✅ **Diverse**: 组合爆炸覆盖异构模式

---

## Experimental Results

### Training Configuration
- **Model**: Qwen3-8B
- **Data**: 48k SFT + 3.2k RL
- **Tools**: 373 across 5 domains (Finance/Biology/Medicine/Academia/General)

### Performance Gains

| Metric | Improvement |
|--------|-------------|
| **9 OOD Benchmarks** | +22 average points |
| **vs Strongest 8B Baseline** | **+68%** |
| **Data Efficiency** | 4× less data with diversity scaling |

### Controlled Scaling Analysis

> "Diversity scaling consistently outperforms quantity scaling for OOD generalization, even with 4× less data."

| Scaling Strategy | OOD Generalization |
|------------------|-------------------|
| Quantity (4× data) | Baseline |
| Diversity (matched compute) | **Significantly better** |

---

## OpenClaw Validation Matrix

| DIVE Component | OpenClaw Mapping | Status |
|----------------|------------------|--------|
| **Evidence-First Execution** | Skill真实执行验证 | ✅ 架构一致 |
| **Three-Pool Decoupling** | AGENTS.md/Skill/Context分离 | ✅ 设计哲学一致 |
| **Tool Primitive Duality** | Retrieval↔Skill查询, Processing↔Skill执行 | ✅ 完全映射 |
| **Grounding by Construction** | SKILL.md + 真实工具调用 | ✅ 同构 |
| **Diversity > Quantity** | Skill库多样性优先 | ⚠️ 策略启示 |

---

## Key Insights

1. **Skill Diversity Strategy**: 优先多样性而非数量
2. **Evidence-Driven Development**: DIVE循环与Error Log演进同构
3. **Progressive Disclosure**: 三层池与OpenClaw三层架构对应

---

## Cross-Validation

```
HB#1531 DIVE → HB#1522 XSkill → HB#1505 KernelSkill → HB#1525 SKILL.md Standard
```

---

## L3 Flags

- **#1531-A**: 评估Skill库多样性——工具覆盖度、调用模式异构性
- **#1531-B**: 研究Evidence-Driven模式对Error Log设计的借鉴
- **#1531-C**: 探索DIVE式合成用于自动Skill生成
- **#1531-D**: 形式化"多样性vs数量"权衡决策框架
