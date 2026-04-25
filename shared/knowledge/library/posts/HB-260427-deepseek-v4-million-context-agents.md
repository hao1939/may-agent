# DeepSeek-V4: Million-Token Context for Agent Workloads

**Source**: Hugging Face Blog (April 24, 2026) — DeepSeek
**URL**: https://huggingface.co/blog/deepseekv4

## Core Finding

**DeepSeek-V4** delivers a **1 million token context window** optimized specifically for long-running agentic workloads. The benchmark numbers are competitive but not SOTA — the real innovation is efficient large-context support for agent tasks.

## Model Variants

| Variant | Total Params | Active Params | Context Window |
|---------|--------------|---------------|----------------|
| **V4-Pro** | 1.6T | 49B | 1M tokens |
| **V4-Flash** | 284B | 13B | 1M tokens |

## The Agent Context Problem

Running frontier open models as agents breaks in predictable ways:
1. **Context budget exhaustion** — traces blow past limits
2. **KV cache overflow** — fills GPU memory
3. **Tool-call degradation** — performance drops mid-task

V4 is built to fix these known failures.

## Efficiency Gains vs V3.2

| Metric | V4-Pro vs V3.2 | V4-Flash vs V3.2 |
|--------|----------------|------------------|
| Single-token inference FLOPs | 27% | 10% |
| KV cache memory | 10% | 7% |
| vs GQA-8 (bfloat16) | ~2% cache size | ~2% cache size |

At 1M tokens, V4-Pro requires only **27% of the FLOPs** and **10% of the KV cache memory** compared to V3.2.

## Hybrid Attention Architecture

V4 splits attention into two mechanisms, interleaved across layers:

### Compressed Sparse Attention (CSA)
- **4x compression** along sequence dimension
- Softmax-gated pooling with learned positional bias
- Lightning indexer (FP4, ReLU-scored) picks top-k compressed blocks
- Sliding-window branch for recent uncompressed tokens

### Heavily Compressed Attention (HCA)
- **128x compression** of KV entries
- Dense attention over compressed stream
- Same sliding-window branch for recency

### Layer Pattern (V4-Pro, 61 layers)
- Layers 0-1: HCA
- Layers 2-60: Alternate CSA and HCA
- MTP block: Sliding-window only

### Storage Optimizations
- FP8 for most KV entries
- BF16 only for RoPE dimensions
- Lightning indexer runs in FP4

## Agent-Specific Post-Training

### 1. Interleaved Thinking Across Tool Calls

**V3.2 behavior**: Discarded reasoning traces on new user messages.

**V4 behavior**: Preserves reasoning content across user message boundaries **when conversation contains tool calls**. Complete reasoning history retained across all rounds and user turns.

```
Thinking WITH tools:    [reasoning] → tool → result → [reasoning] → user → [reasoning]...
Thinking WITHOUT tools: [reasoning] → user → [new reasoning] (flushed each turn)
```

### 2. Tool-Call Schema with Dedicated Tokens

- **|DSML|** special token for tool calls
- **XML-based format** (reduces escaping failures vs JSON-in-string)
- **String vs structured parameter separation**:
  - `string="true"` → passed as-is
  - `string="false""` → passed as JSON

This removes parsing errors around numbers and booleans.

### 3. DSec: Sandbox for RL Rollouts

**DeepSeek Elastic Compute (DSec)** — Rust platform with four execution substrates:
- Function calls
- Containers
- MicroVMs (Firecracker)
- Full VMs (QEMU)

**Single cluster**: Hundreds of thousands of concurrent sandboxes.

**Key features for agent training**:
- Fast image loading via layered 3FS storage
- Preemption-safe trajectory replay
- Uniform API across substrates

## Agent Benchmark Results (V4-Pro-Max)

| Benchmark | Score | Comparison |
|-----------|-------|------------|
| **Terminal Bench 2.0** | 67.9 | Ahead of GLM-5.1 (63.5), K2.6 (66.7); behind GPT-5.4-xHigh (75.1), Gemini-3.1-Pro (68.5) |
| **SWE Verified** | 80.6 | Tied with Opus-4.6-Max (80.8), Gemini-3.1-Pro (80.6) |
| **MCPAtlas Public** | 73.6 | Second only to Opus-4.6-Max (73.8) |
| **Toolathlon** | 51.8 | Ahead of K2.6 (50.0), GLM-5.1 (40.7), Gemini-3.1-Pro (48.8) |

Internal R&D coding benchmark (PyTorch, CUDA, Rust, C++): 67% pass rate vs 47% Sonnet 4.5, 70% Opus 4.5.

## Developer Survey

85 DeepSeek developers using V4-Pro as daily driver:
- **52%** said it was ready to replace their previous model

## Significance for OpenClaw

### ✅ Validated Directions
- **Long-context agents**: 1M context enables truly long-horizon tasks
- **Reasoning persistence**: Cross-turn reasoning retention for multi-step workflows
- **XML tool format**: Reduced escaping failures vs JSON
- **Hybrid attention**: Architecture efficiency for agent workloads

### ⚠️ Strategic Considerations
- **KV cache optimization**: Critical for long-context agent deployment
- **Tool call format**: XML vs JSON tradeoffs for OpenClaw's Skill system
- **Sandbox infrastructure**: DSec-level execution environment for training
- **Cost efficiency**: 10% KV cache = 10x longer contexts on same hardware

### 🔬 Research Opportunities
- Evaluate OpenClaw's context utilization at 100K+ token depths
- Implement reasoning persistence across user turns
- Study XML vs JSON tool call reliability
- Design hybrid compression for OpenClaw's memory system

## Related
- [HB-2026](HB-2026-tool-attention-mcp-tax.md) — MCP tax optimization
- [HB-260426](HB-260426-agent-sandbox-infrastructure.md) — Sandbox infrastructure
- [HB-260426](HB-260426-claude-multiagent-orchestration.md) — Multi-agent reasoning
