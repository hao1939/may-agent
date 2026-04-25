# HB-260708: VAKRA — IBM Enterprise Agent Evaluation Benchmark

**Source**: Hugging Face Blog (Apr 15, 2026) — IBM Research  
**URL**: https://huggingface.co/blog/ibm-research/vakra-benchmark-analysis  
**Archived**: 2026-07-08

---

## Overview

VAKRA is a **tool-grounded, executable benchmark** for evaluating AI agent reasoning and action in enterprise-like environments.

Unlike traditional benchmarks testing isolated skills, VAKRA measures **compositional reasoning** across APIs and documents using full execution traces.

---

## Scale

| Metric | Value |
|--------|-------|
| APIs | 8,000+ locally hosted |
| Domains | 62 |
| Databases | Real databases backing APIs |
| Documents | Domain-aligned collections |
| Reasoning Steps | 3-7 step chains typical |

---

## Four Capability Dimensions

### C1: API Chaining (BI APIs)
- **2,077 instances** across 54 domains
- **1-12 tool calls** per task
- Uses SLOT-BIRD + SEL-BIRD collections

**Example**: Find football team with specific build-up play attributes
```json
{
  "query": "Which team has build-up play speed of 31, dribbling of 53, passing of 32?",
  "tool_calls": [
    {"name": "get_data", "arguments": {...}},
    {"name": "select_data_equal_to", "arguments": {"key_name": "play_speed", "value": 31}},
    {"name": "select_data_equal_to", "arguments": {"key_name": "play_dribble", "value": 53}},
    {"name": "select_data_equal_to", "arguments": {"key_name": "play_passing", "value": 32}},
    {"name": "get_team_name", "arguments": {...}}
  ],
  "answer": "FC Barcelona"
}
```

**Key Tool**: `get_data(tool_universe_id=id)` — initializes data source, returns lightweight preview, stores full dataset server-side to avoid MCP large data transfer.

### C2: Tool Selection (Dashboard APIs)
- **1,597 instances** across 17 domains
- **6 to 328 tools per domain** (average: 116)
- Uses expanded REST-BIRD collection

**Challenge**: OpenAI API limits tool list to 128 tools — requires shortlisting mechanism.

### C3: Multi-Hop Reasoning
- **869 instances** across 38 domains
- **1-5 logical hops** per query
- Combine multiple evidence pieces to reach answer

### C4: Multi-Source + Policy Adherence
- **644 instances** across 41 domains
- **Most complex**: API + RAG + Multi-turn + Policy constraints

**Features**:
- Multi-source: Information from APIs OR document indices (decontaminated — each hop has only one valid source)
- Multi-turn: Dialog with context-response pairs
- Tool-usage policies: Plain-text constraints on allowed knowledge sources

**Policy Example**:
```
If user's query pertains to Technology & Software about codebases,
software platforms, applications — answer using ONLY document retrievers.
Do not use other types of tools.
```

---

## Key Finding: Models Perform Poorly

> "As can be seen below, **models perform poorly on VAKRA**"

Current agents struggle with:
1. **Tool selection at scale** (116 avg tools, up to 328)
2. **Multi-hop reasoning** (evidence combination across hops)
3. **Policy adherence** (following source constraints)
4. **Multi-source coordination** (API + RAG switching)
5. **Multi-turn context maintenance**

---

## MCP Optimization Pattern

VAKRA addresses MCP's large data transfer problem:

```python
# Instead of: Full dataset transfer via MCP (expensive)
# VAKRA uses:
get_data(tool_universe_id=id)  # Returns preview only
# Server stores full data
# Subsequent tools operate on server-side data
```

**Result**: Avoids "inefficient transfer of large data over MCP protocol"

---

## What This Means for OpenClaw

| Aspect | Implication |
|--------|-------------|
| ✅ Validation | Compositional reasoning (3-7 steps) is the real test for agents |
| ✅ Tool Attention | C2 validates need for dynamic tool shortlisting (ISO score from Tool Attention paper) |
| ✅ MCP Data Pattern | `get_data` preview + server-side storage pattern worth adopting |
| ⚠️ Gap | We lack explicit policy adherence layer |
| ⚠️ Gap | No multi-source (API+RAG) hybrid query capability |
| ⚠️ Gap | No explicit multi-turn dialog handling |

**Benchmark Inspiration**: VAKRA's 4-layer capability framework excellent for Gym scenario design:
- C1: Skill chaining
- C2: Skill selection at scale
- C3: Multi-step reasoning
- C4: Policy + multi-source

---

## Resources

- **Dataset**: [ibm-research/VAKRA](https://huggingface.co/datasets/ibm-research/VAKRA)
- **Leaderboard**: [ibm-research-vakra.hf.space](https://ibm-research-vakra.hf.space/)
- **GitHub**: [IBM/vakra](https://github.com/IBM/vakra)

---

## Related

- [HB-260425](HB-260425-vakra-ibm-agent-benchmark.md) — Initial coverage
- [HB-260718](HB-260718-tool-attention-deep-dive.md) — Tool Attention (addresses C2 challenges)
