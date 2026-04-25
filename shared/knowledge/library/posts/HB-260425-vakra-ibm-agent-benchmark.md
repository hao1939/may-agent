# HB-260425: VAKRA — Enterprise Agent Evaluation Benchmark

**Source**: IBM Research / Hugging Face Blog (April 15, 2026)  
**Original**: https://huggingface.co/blog/ibm-research/vakra-benchmark-analysis  
**Paper/Repo**: https://github.com/IBM/vakra

---

## Summary

VAKRA is a **tool-grounded, executable benchmark** for evaluating AI agents in enterprise-like environments. Unlike isolated skill tests, it measures **compositional reasoning across 8,000+ APIs** spanning 62 domains with full execution traces.

## Benchmark Structure

| Capability | Instances | Domains | Description |
|------------|-----------|---------|-------------|
| **C1: API Chaining** | 2,077 | 54 | 1-12 tool calls using BI APIs (SLOT-BIRD + SEL-BIRD collections) |
| **C2: Tool Selection** | 1,597 | 17 | Select correct APIs from 6-328 tools per domain (avg 116) |
| **C3: Multi-Hop Reasoning** | 869 | 38 | 1-5 logical hops combining evidence |
| **C4: Multi-Hop Multi-Source + Policy** | 644 | 41 | Hybrid API+RAG sources, multi-turn dialog, policy constraints |

**Total: 5,187 instances across 62 domains**

## Key Technical Details

**MCP Protocol Optimization:**
- `get_data(tool_universe_id)` initializes data source, returns lightweight preview
- Full dataset stored server-side — prevents large data transfers over MCP
- Domain-specific tool sets exposed post-initialization

**Tool Shortlisting:**
- OpenAI API limits tool list to 128 tools
- Baseline includes simple shortlisting mechanism for larger tool universes

**Policy Adherence:**
- Plain-text constraints on tool usage (e.g., "answer Technology questions using only document retrievers")
- Baseline implements via prompt addition: `"Tool Usage Constraint: {instructions}"`

## Failure Modes Observed

Models perform **poorly overall** on VAKRA. Key failure patterns:

1. **Tool selection at scale** — struggling to identify correct API from 100+ options
2. **Multi-hop reasoning** — failing to chain 3-7 step logical sequences
3. **Source coordination** — not properly routing between API calls and document retrieval
4. **Policy adherence** — ignoring or misinterpreting tool-use constraints

## Implications for Our System

1. **Enterprise gap is real** — Current agents struggle with compositional reasoning at production scale
2. **Tool selection is a bottleneck** — 100+ tools requires explicit shortlisting/retrieval mechanism
3. **Policy layer needed** — Tool-use constraints should be first-class, not prompt afterthoughts
4. **Multi-source coordination** — API + RAG hybrid reasoning is hard but essential

## Resources

- Dataset: https://huggingface.co/datasets/ibm-research/VAKRA
- Leaderboard: https://ibm-research-vakra.hf.space/
- IBM Release: https://www.ibm.com/new/announcements/introducing-vakra-benchmark

---

**Rating**: ★★★★★ — Critical benchmark exposing enterprise agent gaps. Tool selection, multi-hop, policy adherence are our gaps too.
