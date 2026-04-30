# HB2161 — Pythia: Agent-Native LLM Serving

**Paper:** arXiv:2604.25899
**Authors:** Shan Yu et al. (17 authors)
**Date found:** 2026-04-29

## Core Idea

Multi-agent architectures introduce **structural predictability** that current LLM serving systems ignore — they treat agent traffic as generic requests. Pythia exploits workflow topology to optimize serving.

## Key Problems Identified (from production traces)

1. **Low prefix cache hit rates** — agents don't share prefixes efficiently
2. **Resource contention from long-context requests** — one long agent blocks others
3. **Queuing delays from suboptimal scaling** — can't predict agent demand

## Solution

Pythia captures workflow semantics through a simple interface at the serving layer:
- Knows which agent calls which → can pre-warm caches
- Knows expected output lengths → can schedule better
- Knows topology → can scale specific agents independently

Substantially improves throughput and job completion time over SOTA.

## 对我们系统的意义

1. **Our multi-agent system has predictable structure.** We could benefit from agent-aware serving — the orchestrator knows the DAG, the serving layer should too.

2. **Prefix cache optimization is low-hanging fruit.** If agents share system prompts or skill descriptions, serving should cache those prefixes across calls.

3. **This validates "harness-aware infrastructure."** The harness isn't just prompt management — it extends into the serving layer. Serving should understand agent topology.

4. **Practical implication:** When we scale, we need serving infrastructure that understands our agent graph, not just generic vLLM.

## Tags
#infrastructure #serving #multi-agent #prefix-cache #systems
