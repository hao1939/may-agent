# DD#385 — Not All Prefills Are Equal: PPD Disaggregation for Multi-Turn LLM Serving

**Paper:** arXiv:2603.13358
**Date:** 2026-03-17
**Focus:** LLM serving architecture / multi-turn optimization

---

## 1. Core Problem

**Prefill-Decode (PD) disaggregation** is the standard modern LLM serving architecture: prefill nodes handle prompt processing, decode nodes handle token generation. But in **multi-turn interactions** (chatbots, agentic workflows), this creates two fundamental inefficiencies:

1. **Redundant prefilling:** Every turn requires prefilling the new prompt AND the response from the last turn, even though KV states for prior context already exist on decode nodes
2. **KV transfer saturation:** Repeatedly transferring KV caches between prefill and decode nodes saturates bandwidth, causing high latency and service degradation

These inefficiencies worsen as conversation length grows — precisely the scenario for agentic multi-turn workflows.

## 2. Technical Approach

### Key Insight: Two Types of Prefill
Not all prefill operations are equally disruptive:
- **Full prefill:** Processing an entirely new prompt from scratch — compute-intensive, appropriate for prefill nodes
- **Append-prefill:** Processing only new input tokens while reusing cached KV states — lightweight, can coexist with decoding

### PPD Architecture
**Prefill + Prefill-capable Decode (PPD):**
- Turn 1: Standard PD disaggregation (prefill node → decode node)
- Turn 2+: **Route append-prefill to decode nodes** that already hold KV caches from prior turns
- Dynamic routing decision based on:
  - Current decode node load
  - SLO requirements (TTFT vs TPOT priorities)  
  - KV cache locality (does the decode node hold prior context?)
  - Configurable weight parameters

### No Fixed Strategy Works
The paper proves through comprehensive analysis that **no single fixed routing strategy** satisfies all SLOs simultaneously. Dynamic adaptation is necessary. PPD's configurable weights allow operators to tune the TTFT/TPOT tradeoff per deployment.

## 3. Key Results

| Metric | Improvement |
|--------|-------------|
| Turn 2+ TTFT | **68% reduction** |
| TPOT | **Competitive** with pure PD |
| KV transfer | **Eliminated** for cached turns |
| Integration | Seamless with existing PD deployments |

## 4. Multi-Agent Significance

### For Agentic Systems
Multi-turn interaction is the **defining pattern** of agentic workflows. An orchestrator repeatedly queries specialist agents, each building on prior context. PPD directly optimizes this:
- Agent conversations maintain KV locality on decode nodes
- Subsequent queries to the same agent avoid full prefill + KV transfer
- 68% TTFT reduction compounds across multi-step agent chains

### Connection to Portfolio

| Paper | Connection |
|-------|-----------|
| DD#384 (ICaRus) | ICaRus shares caches across models; PPD optimizes cache locality across turns — **complementary temporal vs model dimensions** |
| DD#380 (RelayCaching) | RelayCaching pipelines KV caches between agents; PPD keeps them local to avoid transfer — **alternative strategies for the same bottleneck** |
| DD#371 (IndexCache) | IndexCache reduces prefill computation; PPD eliminates redundant prefill entirely for subsequent turns |
| DD#366 (CacheBlend) | CacheBlend validates cache reuse quality; PPD's append-prefill is a production deployment of selective reuse |
| DD#293 (CoMAM) | Multi-agent memory with multi-turn coordination benefits directly from PPD's turn-aware routing |

### The Three-Layer KV Stack (Updated)
1. **Within-model:** IndexCache (sparse attention, DD#371)
2. **Cross-model:** ICaRus (shared KV generation, DD#384)
3. **Cross-turn:** PPD (append-prefill routing, DD#385)
4. **Cross-agent:** RelayCaching (sequential KV transfer, DD#380)

These four layers form a **comprehensive KV optimization stack** for multi-agent multi-turn LLM serving.

## 5. Limitations

- Decode nodes must have **sufficient compute headroom** for append-prefill alongside decoding
- Dynamic routing adds **scheduling complexity** and potential for suboptimal decisions under rapid load changes
- Evaluated primarily on **chatbot workloads** — agentic patterns with branching/parallel queries need further study
- SLO weight tuning requires **operational expertise** — no automatic adaptation proposed

## 6. Relevance Rating

**★★★☆ MODERATE-HIGH** — Directly addresses the serving infrastructure for multi-turn agentic interactions. The 68% TTFT reduction for subsequent turns is significant for interactive agent systems. Completes the four-layer KV optimization taxonomy.

## 7. Key Takeaway

> **In multi-turn LLM serving, append-prefill (processing only new tokens while reusing cached KV) is fundamentally different from full prefill and should be routed to decode nodes that already hold context. PPD's dynamic routing reduces Turn 2+ TTFT by 68%, making it a critical optimization for the repeated query patterns that define agentic workflows.**

---
*Scout research — Session 2026-03-17*
*Cross-references: DD#384, DD#380, DD#371, DD#366, DD#293*
