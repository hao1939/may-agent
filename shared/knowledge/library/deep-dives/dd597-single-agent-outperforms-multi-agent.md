# DD#597 — Single-Agent Outperforms Multi-Agent on Multi-Hop Reasoning

**Source:** arXiv:2604.02460 (Tran & Kiela, Apr 2026)
**Domain:** MAS vs SAS · Compute Efficiency · Information Theory · Reasoning
**Submitted:** 2026-04-07 by Scout

---

## Key Findings

### The Core Claim
When computation is **normalized** (equal thinking-token budgets), single-agent systems (SAS) **consistently match or outperform** multi-agent systems (MAS) on multi-hop reasoning tasks.

### Information-Theoretic Argument
Uses the **Data Processing Inequality (DPI)** to show that under fixed token budgets with perfect context utilization, single-agent systems are more information-efficient. Every inter-agent communication step is a lossy channel that can only destroy information, not create it.

### When Multi-Agent Becomes Competitive
The theory predicts (and experiments confirm) MAS becomes competitive when:
1. **Context utilization is degraded** — a single agent can't effectively use all available context (too long, too noisy)
2. **More compute is available** — MAS can exploit additional tokens through parallel exploration

### Empirical Validation
- Three model families: Qwen3, DeepSeek-R1-Distill-Llama, Gemini 2.5
- Multiple MAS architectures tested
- SAS matches/beats MAS on multi-hop reasoning when tokens held constant

### Critical Methodology Finding
**Significant artifacts in API-based budget control** (particularly Gemini 2.5) and in standard benchmarks can **inflate apparent MAS gains**. Many published MAS advantages are better explained by unaccounted computation.

---

## GStack Relevance: ★★★★★

### The "When to Multi-Agent" Decision Framework

This paper provides the clearest answer yet to when multi-agent is justified:

| Condition | Best Architecture |
|-----------|------------------|
| Context fits in one window + fixed budget | Single agent |
| Context exceeds effective window | Multi-agent (distributed context) |
| Compute budget is flexible | Multi-agent (parallel exploration) |
| Task requires diverse perspectives/roles | Multi-agent (specialization) |
| Task is pure reasoning chain | Single agent |

### Direct Implications for GStack

1. **Don't multi-agent for multi-agent's sake**: For tasks that are fundamentally sequential reasoning, a single agent with good context is more efficient. This validates our approach of having specialized agents (Scout, Bob) rather than generic debate teams.

2. **Justify every agent boundary**: Each inter-agent handoff is an information-lossy channel. The specialization benefit must exceed the communication cost. Scout → Bob works because the specialization benefit (research vs synthesis) exceeds the lossy handoff.

3. **Context is the key variable**: The paper shows SAS fails when context utilization degrades. This means investing in **context engineering** (DD#598) is more valuable than adding agents.

4. **Budget-aware architecture**: Design should consider token budgets explicitly. Some tasks should dynamically choose between single-agent and multi-agent based on available budget and context size.

### Connects DD#590 and DD#595
- DD#590 showed memory augmentation beating multi-agent empirically
- DD#595 explains WHY via the integration bottleneck
- This paper provides the **information-theoretic foundation**: DPI means inter-agent channels are lossy

---

## Connections

- **DD#590**: Memory+single-agent vs multi-agent — same finding, different methodology
- **DD#595**: Integration bottleneck — the structural explanation for WHY single beats multi
- **DD#598**: Context Engineering — if context quality is the key variable, context engineering is the key investment
- **DD#578**: Lifelong memory scaling — better memory = better single-agent context utilization

---

## Status: READY FOR HANDOFF
