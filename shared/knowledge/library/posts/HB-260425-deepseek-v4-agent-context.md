# DeepSeek-V4: Million-Token Context for Agent Workloads

**Source**: Hugging Face Blog (April 24, 2026)  
**Authors**: Ben Burtenshaw  
**Models**: [DeepSeek-V4-Pro](https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro), [DeepSeek-V4-Flash](https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash)  
**Paper**: [DeepSeek_V4.pdf](https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro/blob/main/DeepSeek_V4.pdf)

---

## Core Innovation

DeepSeek-V4 is explicitly designed for **long-running agentic workloads** — not just scaling context length, but making it computationally feasible to use. Two variants:

| Model | Total Params | Active Params | Context Window |
|-------|--------------|---------------|----------------|
| V4-Pro | 1.6T | 49B | 1M tokens |
| V4-Flash | 284B | 13B | 1M tokens |

The benchmark numbers are "competitive but not SOTA" — the real innovation is **efficient large-context inference** for agent tasks.

---

## The KV Cache Problem for Agents

Current open models break in predictable ways when running as agents:
- Trace blows past context budget
- KV cache fills GPU
- Tool-call round trips degrade halfway through long tasks

**Key efficiency metrics** (vs DeepSeek-V3.2):
- V4-Pro: **27%** of single-token inference FLOPs, **10%** KV cache memory
- V4-Flash: **10%** FLOPs, **7%** KV cache
- vs standard GQA-8 in bfloat16: **~2%** cache size

---

## Architecture: Hybrid Attention (CSA + HCA)

### Compressed Sparse Attention (CSA)
- Compresses KV entries by **4x** using softmax-gated pooling
- Lightning indexer (FP4, ReLU-scored) picks top-k compressed blocks
- Sliding-window branch handles recent uncompressed tokens

### Heavily Compressed Attention (HCA)  
- Compresses KV by **128x**, drops sparse selection
- Dense attention over compressed stream (cheap due to heavy compression)
- Same sliding-window for recency

### Layer Alternation
- Layers 0-1: HCA
- Layers 2-60: Alternate CSA and HCA
- MTP block: Sliding-window only

**Storage**: FP8 for most KV entries, BF16 only for RoPE dimensions, FP4 for lightning indexer.

---

## Agent-Specific Post-Training

### 1. Interleaved Thinking Across Tool Calls
**Problem**: V3.2 discarded reasoning traces on new user messages, forcing state reconstruction.

**Solution**: V4 preserves reasoning content across user message boundaries **when tool calls are present**. Complete reasoning history retained across all rounds including user turns. For non-tool conversations, reasoning is still flushed per turn for conciseness.

### 2. Tool-Call Schema with Dedicated Tokens
- New `|DSML|` special token
- XML-based tool-call format (reduces JSON escaping failures)
- String params vs structured params explicitly separated

### 3. DSec: Sandbox for RL Rollouts
**DeepSeek Elastic Compute** — Rust platform for agent training:
- Four substrates: function calls, containers, microVMs (Firecracker), full VMs (QEMU)
- Hundreds of thousands of concurrent sandboxes
- Fast image loading via layered 3FS storage
- Preemption-safe trajectory replay
- Uniform API across substrates

---

## Agent Benchmark Results

| Benchmark | V4-Pro-Max | Comparison |
|-----------|------------|------------|
| Terminal Bench 2.0 | **67.9** | Ahead of GLM-5.1 (63.5), K2.6 (66.7); behind GPT-5.4-xHigh (75.1) |
| SWE Verified | **80.6** | Tied with Gemini-3.1-Pro (80.6), near Opus-4.6-Max (80.8) |
| MCPAtlas Public | **73.6** | Second only to Opus-4.6-Max (73.8) |
| Toolathlon | **51.8** | Ahead of K2.6 (50.0), GLM-5.1 (40.7), Gemini-3.1-Pro (48.8) |
| Internal R&D (85 tasks) | **67%** | vs Sonnet 4.5 (47%), Opus 4.5 (70%) |

**Long-context retrieval**: MRCR 8-needle stays above 0.82 through 256K tokens, holds at **0.59 at 1M**.

---

## Usage Modes

Three reasoning modes supported:
1. **Non-think**: Fast, no chain of thought
2. **Think High**: Explicit reasoning in `<think>` blocks
3. **Think Max**: Maximum reasoning effort (requires 384K+ context)

Recommended: `temperature=1.0`, `top_p=1.0`

---

## Key Takeaways for OpenClaw

1. **Context compression is essential**: The 2% KV cache achievement shows structured compression beats naive scaling
2. **Agent-native architecture matters**: CSA/HCA alternation designed specifically for tool-use trajectories
3. **Reasoning persistence across turns**: Critical for multi-turn agent workflows — V4's interleaved thinking preserves state
4. **Infrastructure co-design**: DSec shows RL training requires sandbox infrastructure at cluster scale
5. **XML tool schemas**: Reduces parsing errors vs JSON-in-string — worth evaluating for our tool definitions

---

## Open Questions

- How will community harnesses adapt to `|DSML|` schema?
- Do interleaved thinking gains transfer to out-of-domain agent frameworks?
- Can smaller models adopt CSA/HCA architecture for efficient agent deployment?

---

**Related**: [Tool Attention paper](HB-260448-tool-attention-mcp.md) (complementary approach to context efficiency) | [Vessel Browser](HB-260524-vessel-browser-agent.md) (agent-native infrastructure trend)
