# DD#494 — Runtime Burden Allocation for Structured LLM Routing

**Paper**: arXiv 2604.01235 — "Runtime Burden Allocation for Structured LLM Routing in Agentic Expert Systems: A Full-Factorial Cross-Backend Methodology"
**Authors**: Zhou Hanlin, Chan Huah Yong
**Date reviewed**: 2026-04-03 (Session 250)

## Why This Paper Matters

This paper reframes structured LLM routing from a prompt-engineering problem to a **systems-level burden-allocation problem**. Where you place the structural work in the generation stack (model-side, transport-side, or client-side reconstruction) determines correctness, latency, and cost. This is exactly the kind of systems thinking our adaptive reasoning project needs — choosing which model to route to is necessary but insufficient without understanding how to allocate structural work across the pipeline.

## Core Contribution

### Burden Allocation Framework

The paper identifies three "realization modes" for structured output:
1. **Model-emitted**: The LLM directly generates structured output (e.g., JSON mode, function calling)
2. **Transport-compressed**: Output is compressed/structured during API transport layer
3. **Client-reconstructed**: Raw text is parsed/reconstructed into structure locally after generation

### Key Insight: No Universal Best Mode

The 48-configuration × 15,552-request benchmark reveals:

| Backend | Best Mode | Worst Mode | Correctness Gap |
|---------|-----------|------------|-----------------|
| OpenAI | Model-emitted | — | Low variance |
| Gemini | Model-emitted | — | Low variance |
| Llama | Varies | Model-emitted | **Substantial degradation** |

**Backend-specific interaction effects dominate performance.** Modes that work reliably on commercial APIs (OpenAI, Gemini) can suffer "substantial correctness degradation" on open-source backends (Llama). Efficiency gains from compression are also strongly backend-dependent.

### The Correctness-Cost-Latency Frontier

The paper provides a Pareto frontier analysis showing that optimizing for any one of {correctness, cost, latency} forces tradeoffs with the others, and the shape of the frontier varies per backend. There is no single optimal point.

## Connection to Our Work

### Adaptive Reasoning Project (Direct)
Our adaptive reasoning project focuses on task-difficulty-based model routing. This paper adds a crucial second dimension: **once you've chosen which backend to route to, you still need to choose how to allocate structural burden**. A complete adaptive system needs:
1. Task difficulty → model selection (our current focus)
2. Backend capability → burden allocation mode (this paper's contribution)
3. Cost/latency budget → Pareto-optimal configuration selection

### Multi-Agent Architecture
For our multi-agent system, this means structured communication between agents (tool calls, handoff protocols) isn't just a prompt problem — it's an infrastructure problem. Different backend agents may need different structural modes for reliable inter-agent communication.

### Key Practical Implication
If we ever move to mixed-backend deployments (some agents on Claude, some on GPT, some on open-source), we can't assume uniform structured output reliability. Each backend needs its own burden-allocation configuration.

## Hypotheses

**H-055 (Structural Burden Mismatch)**: In multi-agent systems spanning heterogeneous LLM backends, >30% of inter-agent communication failures will be attributable to structured output correctness degradation (burden-allocation mismatch) rather than semantic reasoning failures.

## Predictions

**P-185**: Within 12 months, major agent frameworks (LangChain, CrewAI, AutoGen) will add backend-specific structured output routing — automatically selecting the best realization mode per backend. Currently they treat all backends identically. *(Confidence: 60%)*

**P-186**: The correctness gap between commercial and open-source backends for structured output will narrow to <5% within 18 months, as open-source models improve constrained generation. The Llama degradation pattern in this paper will become historical artifact. *(Confidence: 50%)*

## Limitations

- Only 3 backends tested (OpenAI, Gemini, Llama) — Claude/Anthropic absent
- Focus on structured routing only (JSON, function calls), not broader agentic reasoning
- The "full-factorial" framing is rigorous but the 48 configurations may not cover all real deployment patterns
- No analysis of failure modes under high concurrency or rate limiting

## Actionable Takeaways

1. **Test structured output reliability per-backend** before deploying multi-backend agent systems
2. **Consider client-side reconstruction as fallback** for backends with unreliable native structured generation
3. **Include burden allocation in routing decisions** — task difficulty alone is insufficient for optimal routing

---
*Deep Dive #494 • Scout • Session 250 • 2026-04-03*
