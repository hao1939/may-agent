<ai_context>
summary: "arXiv triage of 4 papers from July 9, 2026: proactive memory agents (behavioral state decay), agent-aware LLM scheduling (SMetric), rate-distortion view of memory compaction, and open-source multi-agent framework ecosystem health metrics."
triggers: ["arXiv triage", "agent memory", "proactive memory", "behavioral state decay", "LLM scheduling", "agent serving", "memory compaction", "rate-distortion", "framework ecosystem", "contributor density"]
last_updated: "2026-07-11"
source_basis: "arXiv API queries: cat:cs.AI AND all:'agent', all:'LLM agent' AND (all:'memory' OR all:'tool'), all:'AI agent' AND all:'multi-agent' (July 9 papers, deduplicated against prior triages)"
</ai_context>

# arXiv Triage — July 9, 2026 (Batch 192)

*Triaged: 2026-07-11 | Source: `https://export.arxiv.org/api/query`*

---

## ★★★★★ High Relevance

### [2607.08716] Remember When It Matters: Proactive Memory Agent for Long-Horizon Agents
- **Authors**: (not extracted)
- **Source**: https://arxiv.org/abs/2607.08716
- **Categories**: cs.AI, cs.CL
- **Summary**: Introduces "behavioral state decay" — as agent trajectories grow, decision-relevant state (requirements, facts, prior attempts, diagnoses, open subgoals) gets buried in or pushed beyond the context window. Proposes a separate **memory agent** that runs alongside an unmodified action agent, updating a structured memory bank and deciding whether to inject memory-grounded reminders or remain silent. Plug-and-play with existing agent harnesses.
- **Key findings**: +8.3pp on Terminal-Bench 2.0, +6.8pp on τ²-Bench. Selective intervention outperforms passive bank exposure, always-on injection, advisor-only guidance, and general retrieval. Trains open-weight memory policy (Qwen3.5-27B) via SFT+GRPO with partial transfer.
- **Implication for us**: Names our problem precisely — "behavioral state decay" is why agents lose track of earlier context/decisions as sessions lengthen. The "selective intervention" finding validates a design where memory isn't always injected but surfaces only when relevant. Connects directly to the Eternal Present thesis. The open-weight memory policy training is a path toward cheaper, specialized memory agents rather than relying on frontier models for memory management.

### [2607.08565] SMetric: Rethink LLM Scheduling for Serving Agents with Balanced Session-centric Scheduling
- **Source**: https://arxiv.org/abs/2607.08565
- **Summary**: First systematic study of LLM request scheduling specifically for agent workloads (vs. human chat). Two key observations: (1) agents act only on complete responses, making cluster TPS the primary goal rather than per-token latency; (2) agent requests share >80% KV-cache tokens within sessions (vs. 54-62% in chat). Existing schedulers over-prioritize KV-cache routing, creating hotspots. SMetric routes only the first request per session for load balance, then cache-aware for follow-ups. Result: 10-16% TPS improvement under prefill-decode colocation, 2-34% under disaggregation.
- **Implication for us**: The shift from "per-token latency" to "cluster TPS" as the primary metric for agent serving is a fundamental insight. Agent workloads have fundamentally different scheduling properties than chat. As we scale agent operations, understanding that KV-cache locality within sessions is >80% means session-aware routing is a major efficiency lever.

## ★★★★ Moderate-High Relevance

### [2607.08032] What to Keep, What to Forget: A Rate-Distortion View of Memory Compaction in LLMs and Agents
- **Source**: https://arxiv.org/abs/2607.08032
- **Summary**: Unifies four separate memory-compaction communities (KV-cache eviction, prompt compression, architectural state bounding, agent memory consolidation) under a single rate-distortion framework. Shows they're all instances of one problem: deciding what context-derived information to retain vs. discard under resource budgets. Builds seven-axis taxonomy. Key finding: at every layer, the retention signal is attention magnitude or recency, and it fails everywhere the same way — by discarding before the query is known, information the query later needs.
- **Implication for us**: The "discard before you know what you'll need" failure mode is exactly what behavioral state decay causes in practice. The unification across KV-cache, prompts, and agent memory suggests our memory design should think in rate-distortion terms: what's the minimum-cost encoding that preserves task-relevant information? Also reveals that no benchmark tests repeated compaction across all layers simultaneously — a major evaluation gap.

### [2607.02453] Adoption and Ecosystem Health: A Longitudinal Analysis of Open-Source Multi-Agent Frameworks
- **Authors**: Xi Zhang et al. (Cisco Systems, Indiana University)
- **Source**: https://arxiv.org/abs/2607.02453
- **Summary**: Analyzes 15 major OS agent frameworks (late 2022–early 2026). Stars are unreliable (AutoGPT: 111k stars, <9 contributors/1000 stars; LangChain: 41). LangChain functions as shared infrastructure (82.5% cross-ecosystem contributors). Retention drops steeply in first 30 days, stabilizes at 90.
- **Implication for us**: "Contributor density" (contributors per 1000 stars) as health metric is immediately useful for evaluating framework dependencies. The finding that LangChain is the shared-infrastructure hub (82.5% cross-ecosystem) means its design decisions propagate broadly. Retention cliff at 30 days suggests that framework onboarding experience is the critical adoption gate.

---

## Meta-Pattern

**Memory is the next frontier for agent architecture differentiation.** Three papers in this batch address memory from different angles: proactive injection (behavioral state decay), infrastructure scheduling (KV-cache session locality), and theoretical unification (rate-distortion). The common insight: passive memory (just store everything, retrieve on demand) fails systematically. Effective memory requires active decisions about *what* to keep, *when* to surface it, and *how* to route infrastructure to exploit locality. The "Eternal Present" problem is now recognized across multiple research communities simultaneously.
