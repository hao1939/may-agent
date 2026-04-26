# Tool Attention: Dynamic Tool Gating Eliminates MCP Tax

**Source**: arXiv:2604.21816 (April 2026)  
**Authors**: Anuj Sadani, Deepak Kumar  
**GitHub**: https://github.com/asadani/tool-attention  
**Code Status**: ✅ Reference implementation available

---

## Core Problem: The MCP Tax

MCP (Model Context Protocol) has become the standard for connecting LLM agents to external tools, but its **stateless, eager schema injection** imposes a hidden per-turn overhead:

- **10k–60k tokens** per turn in typical multi-server deployments
- Inflates key-value cache, degrades reasoning as context approaches 70% fracture point
- Turns token budgets into **recurring operational cost**

---

## Solution: Tool Attention

A middleware-layer mechanism that generalizes "Attention Is All You Need" from self-attention over tokens to **gated attention over tools**.

### Three Components

| Component | Function |
|-----------|----------|
| **Intent Schema Overlap (ISO)** | Sentence embedding-based relevance score between user intent and tool schemas |
| **State-Aware Gating** | Enforces preconditions and access scopes dynamically |
| **Two-Phase Lazy Loader** | Compact summary pool always resident; full JSON schemas loaded on-demand for top-k gated tools |

### Performance Results

On simulated 120-tool, six-server benchmark:

| Metric | Naive MCP | Tool Attention | Improvement |
|--------|-----------|----------------|-------------|
| Per-turn tool tokens | 47.3k | 2.4k | **95.0% reduction** |
| Effective context utilization | 24% | 91% | **3.8x improvement** |
| Always-resident summary pool | 100% | 1.4% | **98.6% reduction** |
| Per-turn marginal schema cost | baseline | 8.1% | **91.9% reduction** |

---

## Key Insights

### 1. Protocol Efficiency > Raw Context Length
> "Protocol-level efficiency, not raw context length, is a binding constraint on scalable agentic systems."

Adding more context window doesn't solve the problem if the protocol wastes it on every turn.

### 2. Lazy Loading is Critical
- Keep **compact summaries** always in context
- Load **full schemas only when gated**
- Amortize cost across conversation

### 3. Gating Must Be State-Aware
- Not just intent matching (ISO score)
- Must check **preconditions** and **access scopes**
- Prevents loading tools that can't be used anyway

---

## Architecture Implications

```
User Query → Intent Embedding → ISO Scoring → State-Aware Gating 
                                               ↓
                                   [Summary Pool Always Resident]
                                               ↓
                                    Top-k Tools Selected
                                               ↓
                              [Full Schemas Loaded On-Demand]
                                               ↓
                                     Agent Execution
```

---

## For OpenClaw

### ✅ Validates CLI-First Strategy
Our bash/CLI tool approach avoids MCP tax entirely for local tools — Tool Attention validates this direction for remote integrations.

### 🔬 Middle Path for Remote Tools
Tool Attention offers a **third option** between:
- CLI (local, transparent, no protocol overhead)
- MCP (standardized, but high per-turn cost)
- **Tool Attention** (MCP-compatible, but 95% token reduction)

### 🔬 Implementation Considerations
- ISO scoring requires sentence embeddings (adds latency)
- State-aware gating needs tool precondition definitions
- Two-phase loading requires schema summary generation

### Critical Questions
1. Should we adopt Tool Attention for remote tool integrations?
2. Can SKILL.md metadata serve as the "summary pool"?
3. How does this interact with our current CLI-first philosophy?

---

## Related
- [HB-0026](HB-0026-mcp-decline-cli-rise.md) — MCP vs CLI community discussion
- [insights-cn.md](../insights-cn.md) — Tool Attention section

---

**Tags**: #mcp #tool-attention #token-efficiency #agent-protocol #arxiv-2604.21816
