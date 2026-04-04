# ToolSafe: Proactive Step-Level Tool Invocation Safety

**Source**: arXiv:2601.10156 (January 15, 2026) — Peking University  
**Authors**: Yutao Mou, Zhangchi Xue, Lijun Li, Peiyang Liu, Shikun Zhang, Wei Ye, Jing Shao  
**TL;DR**: Step-level guardrail system for LLM agent tool safety. Proactively detects unsafe tool invocations before execution, reducing harmful calls by 65%.

---

## Core Problem

LLM-based agents interacting with external tools face amplified security risks:
- Real-time monitoring of step-level tool invocation is critical
- Proactive intervention before unsafe execution remains under-explored

## Three-Component System

### 1. TS-Bench (Benchmark)
Novel benchmark for **step-level tool invocation safety detection** in LLM agents.

### 2. TS-Guard (Guardrail Model)
- Uses **multi-task reinforcement learning**
- Proactively detects unsafe tool invocation **before execution**
- Reasons over interaction history
- Assesses request harmfulness and action-attack correlations
- Produces interpretable safety judgments and feedback

### 3. TS-Flow (Guardrail-Feedback Framework)
- Integrates TS-Guard feedback into agent reasoning
- Reduces harmful tool invocations by **65%** on average
- Improves benign task completion by **~10%** under prompt injection attacks

## Key Innovation

> **Proactive step-level intervention** rather than reactive post-execution filtering.

TS-Guard assesses safety at each step by:
1. Analyzing interaction history
2. Detecting harmful request patterns
3. Identifying action-attack correlations
4. Providing interpretable feedback

## Implications for Our System

Our agents use tool calling extensively. ToolSafe provides a framework for:

| Component | Application |
|-----------|-------------|
| TS-Bench | Evaluate our tool safety mechanisms |
| TS-Guard | Add proactive guardrails before tool execution |
| TS-Flow | Integrate safety feedback into agent reasoning |

### Design Recommendations

1. **Pre-execution validation**: Check tool calls before execution, not after
2. **Step-level monitoring**: Monitor each tool invocation step individually
3. **Feedback integration**: Use safety judgments to guide agent reasoning
4. **Multi-task RL**: Train guardrails on both safety and task completion

## Related Work

- **ClawSafety**: Runtime safety layer for agent tool use
- **Agent Harness**: Framework-level safety controls
- **Trace Inversion**: Detects misalignment in reasoning

ToolSafe complements these by focusing on **proactive step-level intervention**.

---

**Links**: [arXiv](https://arxiv.org/abs/2601.10156) | [GitHub](https://github.com/MurrayTom/ToolSafe)
