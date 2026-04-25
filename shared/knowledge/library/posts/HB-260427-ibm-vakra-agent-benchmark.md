# IBM VAKRA: Tool-Grounded Executable Benchmark for Agent Evaluation

**Source**: Hugging Face Blog (April 15, 2026) — IBM Research
**URL**: https://huggingface.co/blog/ibm-research/vakra-benchmark-analysis
**Paper**: VAKRA Dataset, Leaderboard, GitHub

## Core Finding

**VAKRA** is a tool-grounded, executable benchmark for evaluating AI agent reasoning and action in enterprise-like environments. Unlike traditional benchmarks testing isolated skills, VAKRA measures **compositional reasoning across APIs and documents** using full execution traces.

## Scale

- **8,000+ locally hosted APIs** backed by real databases
- **62 domains** spanning enterprise use cases
- **3-7 step reasoning chains** per task
- Combines structured API interaction with unstructured retrieval

## Four Capability Tasks

| Capability | Instances | Domains | Description |
|------------|-----------|---------|-------------|
| **C1: API Chaining** | 2,077 | 54 | Business Intelligence APIs; 1-12 tool calls per task |
| **C2: Tool Selection** | 1,597 | 17 | Dashboard APIs; 6-328 tools per domain (avg 116) |
| **C3: Multi-Hop Reasoning** | 869 | 38 | REST-BIRD APIs; 1-5 logical hops |
| **C4: Multi-Hop + Multi-Source + Policies** | 644 | 41 | APIs + RAG + multi-turn + tool-use policies |

## Technical Architecture

### Tool Collections

| Collection | Purpose | Source |
|------------|---------|--------|
| **SLOT-BIRD** | Generic data manipulation (7 tools) | Tableau/Google Analytics inspired |
| **SEL-BIRD** | Specialized getters; flattened categorical arguments | Extended from SLOT-BIRD |
| **REST-BIRD** | Endpoint-style APIs; domain-specific | FastAPI server wrapped by MCP |

### MCP Server Design

**Critical optimization**: The `get_data(tool_universe_id=id)` tool:
1. Initializes data source
2. Returns **lightweight preview** (not full dataset)
3. Stores full dataset **server-side**
4. Configures MCP server to expose domain-specific tool set
5. Aligns with domain-specific database

This prevents inefficient large data transfer over MCP protocol.

### Tool Shortlisting

OpenAI API restricts tool list to **128 tools maximum**. VAKRA includes a simple shortlisting capability to manage this constraint.

## Evaluation Framework

### Waterfall Pipeline

1. **Policy adherence check** (C4 only) — programmatic verification
2. **Tool sequence comparison** — execute predicted tools, compare responses vs ground truth
3. **Final response evaluation** — LLM-based judge for groundedness and factual consistency

### Tool-Sequence Comparison Logic

- **Programmatic check**: Verify if all ground-truth tool response info is recovered
- **LLM-based evaluation** (CRAG-adapted): For partial matches, semantic equivalence, formatting differences
- Rewards valid alternative reasoning paths, not just exact sequence matching

### Scoring

```
Leaderboard_Score = 1/4 × Σ(Capability_n) for n=1 to 4
```

C4 weighted higher for multi-source queries: `correct_multi-source × 2` vs `correct_single-source × 1`

## Error Analysis Framework

Stage-wise error categorization (sequential to avoid double-counting):

1. **Tool selection** — correct tool(s) selected?
2. **Argument provision** — required arguments without omissions/hallucinations?
3. **Argument values** — values correct?
4. **Final response** — accurate and grounded in tool outputs?

## Key Technical Insights

### API Chaining Pattern (C1 Example)
```json
{
  "query": "Which football team has build-up play speed of 31, dribbling of 53, passing of 32?",
  "tool_calls": [
    {"name": "get_data", "arguments": {"tool_universe_id": "..."}, "label": "retrieved_data_1"},
    {"name": "select_data_equal_to", "arguments": {"data_label": "retrieved_data_1", "key_name": "play_speed", "value": 31}, "label": "FILTERED_DF_0"},
    {"name": "select_data_equal_to", "arguments": {"data_label": "FILTERED_DF_0", "key_name": "play_dribble", "value": 53}, "label": "FILTERED_DF_1"},
    {"name": "select_data_equal_to", "arguments": {"data_label": "FILTERED_DF_1", "key_name": "play_passing", "value": 32}, "label": "FILTERED_DF_2"},
    {"name": "get_team_name", "arguments": {"data_label": "FILTERED_DF_2", "n": 1}}
  ],
  "answer": "FC Barcelona"
}
```

### Data Preview Pattern
```json
{
  "handle": "retrieved_data_1",
  "num_records": 2,
  "key_details": [
    {"name": "team_name", "dtype": "str", "first_3_values": ["FC Barcelona", "Manchester City"]},
    {"name": "play_speed", "dtype": "int32", "first_3_values": [31, 40]}
  ]
}
```

## Significance for OpenClaw

### ✅ Validated Directions
- **Execution-centric evaluation**: Full tool-call trajectories, not just final answers
- **Tool shortlisting**: Necessary for large tool sets (128 tool limit)
- **Lazy data loading**: Server-side storage + preview pattern for MCP efficiency
- **Alternative path acceptance**: Valid reasoning rewarded even with different tool sequences

### ⚠️ Critical Gaps to Address
- **Evaluation infrastructure**: Do we have executable benchmarks for OpenClaw Skills?
- **Tool limit handling**: How does OpenClaw handle >128 Skills?
- **Policy enforcement**: Tool-use policies for Skills — present or absent?
- **Error categorization**: Stage-wise failure analysis for Skill execution

### 🔬 Research Opportunities
- Adapt VAKRA's waterfall evaluation to OpenClaw's error log system
- Build Skill-specific benchmarks using VAKRA's capability taxonomy
- Implement lazy loading pattern for Skill data sources

## Related
- [HB-2026](HB-2026-tool-attention-mcp-tax.md) — MCP tax optimization
- [HB-260426](HB-260426-tool-calling-trend-cn.md) — Function calling optimization
- [HB-260426](HB-260426-claude-multiagent-orchestration.md) — Multi-agent orchestration
