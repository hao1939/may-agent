<ai_context>
summary: "arXiv triage — three previously untriaged papers from July 12-13, 2026: hierarchical stack-based agent orchestration with lazy discovery (2607.11138), region-aware KV cache eviction for agent inference (2607.10582), and agent architecture comparison in computational journalism (2607.10736). API frontier remains July 13, 2026."
triggers: ["arXiv triage", "hierarchical orchestration", "stack-based execution", "lazy discovery", "KV cache eviction", "MemDecay", "region-aware memory", "agent architecture comparison", "pushdown automaton agents"]
last_updated: "2026-07-14"
source_basis: "arXiv API queries: all:\"AI agent\" AND all:\"multi-agent\", all:\"LLM agent\" AND all:\"memory\", all:\"agent\" AND all:\"safety\" AND all:\"LLM\" — deduplicated against all prior triages"
</ai_context>

# arXiv Triage — Gap Fill (2026-07-14)

*Scanned: 2026-07-14 | Source: arxiv.org API | API frontier: July 13, 2026 (unchanged) | Three previously untriaged papers identified.*

---

## ★★★★ High Relevance

### [2607.11138] A Formal Hierarchical Architecture for Agentic Orchestration with Stack-Based Execution and Lazy Discovery
- **Authors**: Prashant Devadiga, Abhishek, Adithya Mishra, Alok Singh, et al.
- **Source**: https://arxiv.org/abs/2607.11138
- **Categories**: cs.AI, cs.LG
- **Published**: 2026-07-13
- **Summary**: Addresses the decision-space explosion when agents face flat tool registries. Organizes capabilities as a rooted tree (internal nodes route, leaf nodes execute). Runtime enforces a LIFO stack execution loop — a Pushdown Automaton giving agents memory of nested execution contexts with deterministic resumption from any depth. Capability discovery is manifest-driven and lazy: only immediate children of the active node are loaded, so memory/prompt costs scale with explored path, not global registry size. Stack frames provide isolation — outputs from one execution branch cannot leak into another. Benchmarks compare flat vs. hierarchical routing under increasing tool counts and multi-step workflow pressure.
- **Key finding**: Replacing global tool memory with localized stack frames provides isolation guarantees for enterprise deployment. Lazy loading means prompt token cost is O(branch factor) not O(total tools). The Pushdown Automaton formalism gives a clean theoretical grounding for hierarchical agent execution.
- **Implication for us**: Directly relevant to tool routing at scale. Our system uses MCP tools; as tool count grows, this hierarchical pattern becomes necessary. The isolation guarantee (no cross-branch leakage) is a security property we should consider. The "lazy discovery" pattern parallels our compilation gradient: don't load everything upfront, discover incrementally. The stack-based execution model could formalize how nested agent calls maintain context. Links to: agent-architectures.md, agent-protocols-mcp-a2a.md.

### [2607.10582] MemDecay: Region-Aware KV Cache Eviction for Efficient LLM Agent Inference
- **Authors**: Venkatesha Matam, Keon Kim
- **Source**: https://arxiv.org/abs/2607.10582
- **Categories**: cs.LG, cs.AI
- **Published**: 2026-07-12
- **Summary**: Addresses KV cache memory bottleneck for agents with heterogeneous context (system instructions, plans, user turns, tool outputs, reasoning traces). Introduces region-specific base priorities and decay rates instead of uniform eviction. System tokens have half-lives of 148–189 steps vs. 14–16 for scratchpad tokens — an order of magnitude difference. Pinning preserves system-region facts at full-cache accuracy; no baseline preserves more than 13/24 facts. Training-free, works with Qwen2.5-1.5B/3B.
- **Key finding**: Attention lifetimes differ by 10× across semantic regions. Region-aware retention remains effective as context grows while recency-based retention collapses. System instructions deserve permanent pinning; scratchpad is highly ephemeral.
- **Implication for us**: Validates what agent builders intuit: not all context is equal. The quantified half-life difference (10×) between system and scratchpad tokens is a concrete design parameter. For long-running agent sessions, this suggests structured context management — pin governance/system instructions, aggressively evict intermediate reasoning. Connects to: agent-architectures-research.md (IntentKV, CacheWise, TokenPilot sections), the-prompt-mass-problem.md.

---

## ★★★ Moderate Relevance

### [2607.10736] Robo-Reporters: Evaluating Autonomous AI Agents as Algorithmic Gatekeepers in Computational Journalism
- **Authors**: Obada Kraishan, Kulsawasd Jitkajornwanich, Kerk Kee
- **Source**: https://arxiv.org/abs/2607.10736
- **Categories**: cs.CY
- **Published**: 2026-07-12
- **Summary**: First systematic comparison of four agent architectures (monolithic Claude, chain-based LangChain, multi-agent CrewAI, autonomous iterative AutoGPT) across 200 experiments on 50 journalism tasks. Same underlying model and tools, isolating architectural effects. Architecture explains 82% of variance in processing behavior. Multi-agent achieves highest accuracy (84.7%) at 2× time cost. Monolithic shows 71.7% source rejection rate (gatekeeping behavior). Transparency is architectural: frameworks excel at structured attribution, monolithic/iterative at methodological documentation.
- **Key finding**: Architecture choice dominates performance variance (82% explained) even with identical model and tools. Multi-agent trades time for accuracy. The "source rejection as gatekeeping" observation in monolithic agents suggests implicit filtering behaviors that are invisible without comparison.
- **Implication for us**: The 82% architecture-explains-variance finding is striking — confirms that system design matters more than model choice for behavioral outcomes. The accuracy/latency tradeoff between multi-agent (84.7%, 2× time) and single-agent architectures is a concrete planning parameter. The invisible gatekeeping finding (71.7% source rejection by monolithic agent) connects to our silent-failure/fail-plausible themes — agents filter information without reporting the filtering. Links to: multi_agent_trends.md, agent-architectures.md.

---

## Frontier Status

API frontier remains **July 13, 2026**. All papers through this date have now been triaged across cumulative scanning sessions.
