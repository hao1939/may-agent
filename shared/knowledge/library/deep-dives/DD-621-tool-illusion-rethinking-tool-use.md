### arXiv:2604.03465 — The Tool Illusion: Rethinking Tool Use in Large Language Models

| Field | Value |
|-------|-------|
| Authors | (from cs.CL/cs.AI listings) |
| Venue | Preprint, April 2026 |
| Rating | ★★★★ |
| Relevance | Contrarian but well-argued position paper challenging the assumption that tool use improves LLM performance. Direct implications for our agent architecture decisions around tool proliferation. |

**Core Problem:** The prevailing paradigm assumes that giving LLMs access to tools (calculators, search engines, code interpreters, APIs) improves their capability. But is this actually true in a rigorous, controlled sense? This paper argues the answer is "it depends, and often no."

**The Tool Illusion Thesis:**
Tool use in LLMs often provides an *illusion* of improved capability while actually:
1. **Shifting errors rather than eliminating them** — The model trades reasoning errors for tool-selection errors, tool-invocation errors, and result-interpretation errors
2. **Adding latency and complexity** without proportional accuracy gains
3. **Creating a false sense of reliability** — Users trust tool-augmented outputs more even when accuracy is similar to tool-free outputs

**Key Findings:**
- **Error Migration**: On mathematical reasoning tasks, tool-augmented models reduce arithmetic errors by 90% but introduce tool-selection errors, parameter formatting errors, and result-interpretation errors that net out to only 15-20% overall accuracy improvement (vs. the ~90% improvement users expect).
- **The Reliability Paradox**: Users rate tool-augmented model outputs as 40% more trustworthy even when blind evaluation shows similar accuracy. This is the "tool illusion" — the presence of tool calls creates a veneer of rigor.
- **Diminishing Returns with Tool Count**: Performance peaks at 3-5 tools and *declines* with more. Models with 20+ tools perform worse than models with 5 tools on the same tasks, due to the combinatorial complexity of tool selection.
- **Context Window Pollution**: Tool descriptions, call/response formatting, and error handling consume 30-60% of the effective context window, leaving less room for actual reasoning.

**When Tools DO Help:**
The paper isn't purely anti-tool. It identifies conditions where tools provide genuine value:
1. **Deterministic external data access** (current time, database queries, file reads) — Tools are unambiguously valuable here
2. **Computations that require exact precision** (cryptographic hashes, large number arithmetic) — But only when the model can reliably formulate the correct tool call
3. **Actions with real-world side effects** (sending emails, deploying code) — Here tools are necessary, not optional

**When Tools DON'T Help:**
1. **Reasoning tasks** — The model often reasons better in-context than by trying to decompose into tool calls
2. **Tasks requiring judgment** — Tool use adds false precision to inherently fuzzy decisions
3. **Novel tasks** — When the model hasn't seen the tool pattern in training, tool use degrades performance

**Why This Matters for Us:**
1. **Tool Proliferation Warning**: Our agents have access to many tools. This paper suggests we should be deliberately minimalist — every tool added has a cost in context pollution and selection complexity.
2. **The 3-5 Tool Sweet Spot**: The finding that performance peaks at 3-5 tools aligns with our observation that agents work best with focused toolsets. This gives empirical backing to keeping tool interfaces lean.
3. **Trust Calibration**: The reliability paradox is directly relevant to how we interpret agent outputs. Just because an agent used a tool doesn't mean the output is more reliable.
4. **Context Budget Accounting**: The 30-60% context pollution from tool infrastructure is a concrete number we should factor into our context engineering (DD#598).

**Limitations:**
- Position paper with selective benchmarking — the anti-tool findings may not generalize
- Doesn't account for fine-tuned tool use (models specifically trained on tool patterns may not show the same error migration)
- The "tool illusion" framing is provocative but may overstate the case — tools clearly help for many real-world workflows

**Connections:**
- DD#598 Context Engineering — Tool descriptions as context pollution is a key insight
- DD#597 Single Agent Outperforms Multi-Agent — Similar contrarian finding about complexity not helping
- CR#306 Scaling Architecture — Implications for tool allocation in multi-agent systems
- DD#600 ANX Protocol-First Design — Tool interfaces as protocols benefit from this paper's minimalism argument
