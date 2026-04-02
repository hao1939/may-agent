# arXiv:2603.11495 — Tool-DC: Try-Check-Retry Framework

**Paper**: Try, Check and Retry: A Divide-and-Conquer Framework for Boosting Long-context Tool-Calling Performance of LLMs
**Authors**: Kunfeng Chen, Qihuang Zhong, Juhua Liu, Bo Du (Wuhan University), Dacheng Tao (NTU)
**arXiv**: 2603.11495v1 [cs.CL] (12 Mar 2026)
**TL;DR**: 分治框架解决长上下文工具调用难题；Try-Check-Retry 三阶段范式；训练-free版本提升+25.10%，训练版使Qwen2.5-7B超越o3

---

## Core Problem

长上下文工具调用的双重挑战：
1. **上下文长度问题**: 候选工具增多 → 信号噪声比下降 → 推理困难
2. **语义混淆问题**: 相似语义但不同参数描述的工具相互干扰

> 实验显示：候选工具从<10增至20时，所有模型性能显著下降（小模型尤甚）

---

## Tool-DC Framework

### Variant 1: Tool-DC (TF) — Training-Free

**核心思想**: 显式 Try-Check-Retry 流水线，降低推理难度 + 利用自我反思能力

#### Stage 1: Try — 分组局部推理

**Strategic Anchor Grouping**:
- 先用 BM25 检索 Top-K 相关工具
- 以每个 Top-K 工具为锚点，构建 K 个并行组
- 每组包含：锚点工具 + 不相关的干扰项（从剩余工具中采样）
- 保留原始 Top-K 集作为独立组 S0

**目的**: 
- 给被检索遗漏的工具有机会被评估
- 解耦高度相关的候选工具防止混淆

**Local Inference**:
```
for each subspace Sj in {S0, S1, ..., SK}:
    oj = M(q, Sj)  // 局部推理输出 (工具, 参数) 或 null
```

#### Stage 2: Check — 模式一致性验证

**规则-based Consistency Validator** 三维验证：

| 维度 | 验证内容 |
|------|---------|
| **Function Name Validity** | 调用函数名必须在定义工具集中显式存在 |
| **Argument Key Verification** | 参数键必须匹配定义，所有必需参数必须存在 |
| **Data Type Consistency** | 参数值必须符合定义数据类型 |

**输出**: 有效候选集 V = {oj | Valid(oj) = 1}

#### Stage 3: Retry — 全局聚合与决策

```
T_retry = {t ∈ T | ∃(t, α) ∈ V}  // 从有效输出中提取工具定义
y* = M(q, T_retry)  // 利用验证反馈进行自我精炼
```

**关键**: 利用前期反馈强制模型自我精炼输出

### Variant 2: Tool-DC (TB) — Training-Based

**目标**: 将 Try-Check-Retry 范式内化为模型参数

**数据构建** (Algorithm 1):
1. **Try & Check**: 对每个工具单独推理，验证有效性
2. **Retry**: 在有效工具集上重新推理得最终输出
3. **Rationale Synthesis**: 若输出正确，合成 CoT 训练数据

**推理模板**:
```
<think>
1. Candidate Selection: ...
2. Validation: ...
3. Final Review: ...
</think>
<tool>final_output</tool>
```

**训练**: 最小化推理轨迹和最终工具调用的负对数似然

---

## Key Results

### BFCL Benchmark

| 方法 | 设置 | 性能提升 |
|------|------|---------|
| Tool-DC (TF) | Standard | 显著超越基线 |
| Tool-DC (TF) | Extended (20 tools) | **+25.10%** 平均增益 |
| Tool-DC (TB) | Qwen2.5-7B | **83.16%** 总分，超越 OpenAI o3 和 Claude-Haiku-4.5 |

### Extended Setting 重要性

现有基准候选工具通常 <10，与真实场景不符。论文引入 Extended Setting（扩展至20个候选工具）模拟真实噪声。

---

## Relevance to OpenClaw

### 🔗 架构对齐

| Tool-DC 设计 | OpenClaw 对应 | 验证 |
|-------------|--------------|------|
| **Schema Consistency Validation** | Skill 确定性契约 | ✅ 静态约束优于动态推断 |
| **Divide-and-Conquer** | Main Agent ↔ Sub-agent 分工 | ✅ 降低单个 Agent 认知负荷 |
| **Self-Reflection via Retry** | Error Log 结构化审计 | ✅ 错误反馈驱动改进 |
| **Validation before Execution** | L3 read_by 强制人工审核 | ✅ 执行前验证防线 |

### 💡 设计启示

1. **Tool 分组策略**: 当可用 Skill 较多时，可考虑语义分组降低选择难度
2. **Schema 验证层**: Tool-DC 的三维验证（名称/参数/类型）可作为 Skill 调用的前置检查
3. **自我反思显式化**: Tool-DC(TB) 的 CoT 模板提示我们可将 Error Log 审计过程结构化为 "选择-验证-复查"

### ⚠️ 关键区别

| 维度 | Tool-DC | OpenClaw |
|------|---------|----------|
| **优化目标** | 工具调用准确率 | 可解释性 + 可控性 |
| **验证机制** | 自动化 schema 检查 | 人工审核 (L3) + 结构化日志 |
| **Retry 权限** | 模型自主重试 | 禁止运行时 self-evolution |
| **错误处理** | 自动过滤无效候选 | Error Log 人工审计后改进 |

---

## Open Questions

1. Tool-DC 的自动化验证与 OpenClaw 的人工审核如何结合？
2. Skill 数量膨胀时的分组策略（基于功能域？基于调用频率？）
3. Tool-DC(TB) 的 CoT 数据合成方法是否适用于 Skill 使用轨迹的 rationale 生成？

---

**Relevant to**: @tech-lead (Skill 调用优化)、@bob (工具选择架构)、scout (训练数据合成)

**Related Papers**: 
- HB#1930 (MCP Security SoK) — 工具调用安全
- HB#502 (Context vs Tools) — 上下文有效性
