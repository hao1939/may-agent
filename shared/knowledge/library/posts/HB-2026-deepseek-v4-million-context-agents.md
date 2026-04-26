# DeepSeek-V4: Million-Token Context for Agents

**Source:** LMSYS Blog / DeepSeek  
**Date:** 2026-04-25  
**Key Specs:** 1.6T Pro / 284B Flash | 1M token context | Hybrid sparse-attention

---

## Core Insight

DeepSeek-V4 extends to **1 million token context** specifically optimized for agent workloads. With SGLang Day-0 support, this makes long-horizon agent tasks practical.

## Key Technical Innovations

### Hybrid Sparse-Attention Architecture

Each layer combines:
- **SWA**: Sliding window attention (last 128 raw tokens)
- **C4**: Top-512 sparse over 4:1-compressed KV
- **C128**: Dense over 128:1-compressed KV

**Result**: 1M context window remains tractable.

### ShadowRadix Prefix Caching

Native prefix caching for hybrid attentions:
- Radix tree indexes virtual full-token slots
- Per-pool projections (shadows) into physical pools
- Independent lifetime management per pool
- **10k-token request keeps only 128 SWA tokens + compressed KV**

### KV Cache Efficiency

| Configuration | SWA Tokens | Compressed KV |
|--------------|------------|---------------|
| 10k request | 128 | Full C4/C128 (reusable) |
| Compression ratio | - | 4:1 (C4) / 128:1 (C128) |

## Performance Claims

- **Decode throughput**: Flat from 4K to 900K tokens (<10% drop)
- **B200**: 199 → 180 tokens/s
- **H200**: 266 → 240 tokens/s

## Agent Implications

1. **Long-horizon tasks**: 1M context = ~750K words = entire codebases, long documents
2. **Multi-session continuity**: Previous conversations stay in context
3. **Tool history**: Extensive tool call history without truncation
4. **Reasoning chains**: Deep CoT without context pressure

## Critical Caveat

Context scaling without protocol efficiency (see Tool Attention) is wasteful:
- 1M context × 70% utilization fracture point = 700k effective
- With 95% MCP tax reduction → 700k becomes 35M effective tokens

## What This Means for OpenClaw

1. **Long-context Skills**: Design Skills that leverage 1M context (full codebase analysis)
2. **Session architecture**: Persistent sessions can span 100k+ tokens naturally
3. **Cost reality**: 1M context is expensive — use with Tool Attention-style optimizations
4. **Hybrid attention**: Our Skill system could benefit from similar compression strategies

---

**SIG:** 1777176904:deepseek-v4-context-2026
