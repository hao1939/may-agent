# CR#299: Agent Communication Stack — Four Layers of Inter-Agent Messaging

**Date:** 2026-04-06
**Triggered by:** DD#558 (Caveman Token Compression)
**Connects:** DD#556, CR#297, DD#541, CR#296

## Core Observation

Caveman's success reveals that inter-agent communication has an **encoding layer** that was previously implicit. This motivates a layered model of agent communication, analogous to the OSI network stack:

```
L4: Task Semantics    — WHAT to communicate (message content, relevance filtering)
L3: Protocol          — WHEN/WHO to communicate with (timing, topology, routing)
L2: Encoding          — HOW DENSELY to encode (compression, abbreviation, format)
L1: Token Transport   — Raw token generation (inference speed, batching, caching)
```

## Why This Matters

Prior multi-agent systems research optimizes layers in isolation:
- **L1 optimization:** Faster inference (vLLM, speculative decoding, KV-cache)
- **L3 optimization:** Better topologies (hierarchical, debate, market-based)
- **L4 optimization:** Better messages (chain-of-thought, structured output, tool calls)

**L2 was invisible.** Agents defaulted to maximum verbosity natural language. Caveman's 75% reduction at L2 alone demonstrates massive waste at this layer.

## The Layer Independence Principle

Each layer can be optimized independently:
- Compress encoding (L2) without changing what you communicate (L4)
- Change topology (L3) without changing encoding (L2)
- Speed up inference (L1) without changing protocol (L3)

**Multiplicative gains:** Optimizing across layers compounds. 2× at L1 × 4× at L2 × 2× at L3 = 16× total efficiency gain.

## Layer-Specific Optimization Strategies

| Layer | Current State | Optimization | Expected Gain |
|-------|--------------|-------------|---------------|
| L4 | Full natural language messages | Relevance filtering, structured schemas | 2-3× |
| L3 | Full broadcast or fixed hierarchy | Adaptive routing, demand-driven comms | 2-5× |
| L2 | Uncompressed natural language | Caveman-style compression, binary formats | 3-4× |
| L1 | Standard inference | Speculative decoding, caching, batching | 2-3× |

**Theoretical maximum compound gain: 36-180×** token efficiency improvement in multi-agent systems.

## Role-Specific L2 Profiles

Different agent roles have different L2 optima:
- **Scout (research):** Moderate compression — preserve citations, connections, and novel insights; compress meta-commentary
- **Executor (code):** High compression on commentary, zero compression on code blocks (Caveman's approach)
- **Planner:** Low compression — reasoning chains need full articulation for verification
- **Evaluator:** Structured compression — use scoring schemas instead of prose evaluation

## Connection to CR#297 Input Quality Thesis

CR#297: Output = f(Knowledge × Instruction × Reasoning)

The Communication Stack adds: **Delivered_Output = Encode(Output)**

If Encode is lossy but preserves the high-value components, the receiver gets a better signal-to-noise ratio. This is the mechanism behind the "compression improves quality" community observation — compression acts as an implicit noise filter on the output channel.

## Open Question

**Does L2 compression bleed into reasoning?** If the model must generate compressed output, does it allocate fewer thinking tokens to reasoning? The DD#556 connection is critical: effort settings reduce BOTH reasoning and communication. If L2 compression is truly independent of reasoning depth, it's a free lunch. If not, there's a compression-quality tradeoff curve that needs mapping.

**Test:** Compare Read:Edit ratio (DD#541) and task success rate across compression levels. If both hold constant as compression increases, L2 is independent. If they degrade, there's coupling.

---
*Filed: 2026-04-06 Session 279 | Brief format — theoretical framework, pending empirical validation*
