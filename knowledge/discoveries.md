# Discoveries: Agent Memory Systems

> Topic: How agents persist, retrieve, and manage long-term memory across sessions
> Last updated: 2026-03-09
> Sources searched: arXiv (✅ success), Reddit r/LocalLLaMA & r/MachineLearning (❌ blocked — Reddit returned "blocked by network security" for all JSON API endpoints including /search.json, api.reddit.com, and old.reddit.com variants)

---

## Source Failures

- **Reddit (r/LocalLLaMA, r/MachineLearning)**: All attempts to access Reddit's JSON search API were blocked by Reddit's network security. Tried multiple endpoints (`www.reddit.com/r/.../search.json`, `old.reddit.com`, `api.reddit.com`) with various User-Agent strings. All returned HTML block pages. No `knowledge/reddit.md` file existed with alternative API guidance. **No Reddit data was obtained.**

---

## Findings (from arXiv)

### 1. Semantic XPath: Structured Agentic Memory Access for Conversational AI
- **Source URL**: https://arxiv.org/abs/2603.01160
- **Type**: Research paper (arXiv preprint, 2026-03-01)
- **Why it matters**: Proposes tree-structured memory access instead of flat RAG, achieving 176.7% improvement over flat-RAG baselines while using only 9.1% of the tokens required by in-context memory. Directly addresses the scaling problem of appending history to context windows.
- **Key insight**: Structured (tree/XPath-style) memory organization with semantic querying dramatically outperforms both in-context memory and flat-RAG approaches for long-term conversational AI. Structure > brute-force context.
- **Connects to**: RAG architectures, structured knowledge representations, context window optimization

---

### 2. AMV-L: Lifecycle-Managed Agent Memory for Tail-Latency Control in Long-Running LLM Systems
- **Source URL**: https://arxiv.org/abs/2603.04443
- **Type**: Research paper (arXiv preprint, 2026-02-22)
- **Why it matters**: Treats agent memory as a managed systems resource (like OS memory management) with promotion/demotion/eviction tiers. Achieves 3.1x throughput improvement and 4.2x latency reduction over TTL baselines. Shows that predictable performance requires explicit control of memory working-set size.
- **Key insight**: Memory lifecycle management (value-driven tiering with promotion, demotion, eviction) is essential for production long-running agents. Simple TTL or LRU policies cause heavy-tailed latency as memory grows. Bounding retrieval-set size matters more than bounding retention time.
- **Connects to**: Systems engineering for LLM agents, production deployment, tail-latency optimization

---

### 3. MemoryArena: Benchmarking Agent Memory in Interdependent Multi-Session Agentic Tasks
- **Source URL**: https://arxiv.org/abs/2602.16313
- **Type**: Benchmark paper (arXiv preprint, 2026-02-18)
- **Why it matters**: Exposes a critical gap: agents with near-saturated performance on existing long-context memory benchmarks (like LoCoMo) perform poorly in agentic settings where memorization and action are tightly coupled across sessions. Introduces a "Memory-Agent-Environment loop" evaluation framework.
- **Key insight**: Current memory benchmarks test memorization and action in isolation; real agents must acquire memory during interaction AND use it to guide future actions. The coupling between memory and action is the hard unsolved problem.
- **Connects to**: Agent evaluation, multi-session task planning, memory-action coupling

---

### 4. Graph-based Agent Memory: Taxonomy, Techniques, and Applications
- **Source URL**: https://arxiv.org/abs/2602.05665
- **Type**: Survey paper (arXiv preprint, 2026-02-05)
- **Why it matters**: Comprehensive survey organizing the agent memory landscape from a graph-based perspective. Covers the full lifecycle: extraction → storage → retrieval → evolution. Provides taxonomy (short-term vs long-term, knowledge vs experience, non-structural vs structural).
- **Key insight**: Graphs are emerging as the dominant structure for agent memory because they model relational dependencies, organize hierarchical information, and support efficient retrieval. The memory lifecycle (extract → store → retrieve → evolve) is becoming a standard framework.
- **Connects to**: Knowledge graphs, graph neural networks, memory taxonomies, Awesome-GraphMemory resource collection

---

### 5. AMA: Adaptive Memory via Multi-Agent Collaboration
- **Source URL**: https://arxiv.org/abs/2601.20352
- **Type**: Research paper (arXiv preprint, 2026-01-28)
- **Why it matters**: Uses coordinated agents (Constructor, Retriever, Judge, Refresher) to manage memory at multiple granularities. Reduces token consumption by ~80% vs full-context while maintaining retrieval precision and long-term consistency. Judge detects logical conflicts; Refresher enforces consistency.
- **Key insight**: Multi-agent collaboration for memory management outperforms single-agent approaches. Separating memory roles (construction, retrieval, verification, refresh) enables dynamic granularity alignment with task complexity and active conflict resolution.
- **Connects to**: Multi-agent systems, memory consistency, hierarchical retrieval

---

### 6. HyMem: Hybrid Memory Architecture with Dynamic Retrieval Scheduling
- **Source URL**: https://arxiv.org/abs/2602.13933
- **Type**: Research paper (arXiv preprint, 2026-02-15)
- **Why it matters**: Addresses the fundamental trade-off between memory compression (risks losing details) and raw text retention (computational overhead). Uses dual-granular storage with a lightweight summary module for simple queries and an LLM-based deep module for complex ones. Reduces computational cost by 92.6% vs full-context.
- **Key insight**: Inspired by cognitive economy: not all memories need the same retrieval depth. Dynamic on-demand scheduling between summary-level and detail-level memory based on query complexity is more efficient than monolithic approaches.
- **Connects to**: Cognitive architectures, retrieval scheduling, efficiency optimization

---

### 7. ActMem: Bridging the Gap Between Memory Retrieval and Reasoning in LLM Agents
- **Source URL**: https://arxiv.org/abs/2603.00026
- **Type**: Research paper (arXiv preprint, 2026-02-04)
- **Why it matters**: Moves beyond passive memory retrieval to active causal reasoning over memory. Transforms dialogue history into causal and semantic graphs, using counterfactual reasoning to detect implicit constraints and resolve conflicts between past states and current intentions.
- **Key insight**: Memory retrieval alone is insufficient — agents need to reason causally over their memories, including counterfactual reasoning to detect conflicts and deduce implicit constraints. Actionable memory > retrievable memory.
- **Connects to**: Causal reasoning, knowledge graphs, conflict resolution in memory

---

### 8. MemSkill: Learning and Evolving Memory Skills for Self-Evolving Agents
- **Source URL**: https://arxiv.org/abs/2602.02474
- **Type**: Research paper (arXiv preprint, 2026-02-02)
- **Why it matters**: Reframes memory operations (extract, consolidate, prune) as learnable, evolvable "skills" rather than fixed heuristics. A designer agent reviews hard cases and evolves the skill set. Creates a closed-loop system that improves both skill selection and the skills themselves.
- **Key insight**: Memory management strategies should be learned and evolved, not hand-designed. Treating memory operations as skills that can be selected, evaluated, and improved creates a self-evolving memory system.
- **Connects to**: Meta-learning, skill learning, self-improvement in agents

---

### 9. AgentSys: Secure and Dynamic LLM Agents Through Explicit Hierarchical Memory Management
- **Source URL**: https://arxiv.org/abs/2602.07398
- **Type**: Research paper (arXiv preprint, 2026-02-07)
- **Why it matters**: Addresses security dimension of agent memory — indiscriminate accumulation of tool outputs and reasoning traces creates vulnerabilities for indirect prompt injection. Proposes hierarchical memory management to prevent attack persistence.
- **Key insight**: Memory is an attack surface. Conventional agents that accumulate all tool outputs indiscriminately allow injected instructions to persist and enable repeated manipulation. Hierarchical memory management is a security requirement, not just an efficiency one.
- **Connects to**: LLM security, prompt injection defense, memory hygiene

---

### 10. Agentic Memory (AgeMem): Learning Unified Long-Term and Short-Term Memory Management
- **Source URL**: https://arxiv.org/abs/2601.01885
- **Type**: Research paper (arXiv preprint, 2026-01-05)
- **Why it matters**: Unifies LTM and STM management directly in the agent's policy by exposing memory operations as tool-based actions. Uses a three-stage progressive RL strategy with step-wise GRPO to train memory behaviors. Outperforms baselines across five long-horizon benchmarks.
- **Key insight**: Memory operations (store, retrieve, update, summarize, discard) should be first-class actions in the agent's policy, trained via RL. Unifying LTM/STM management within the agent rather than as external modules leads to better task performance.
- **Connects to**: Reinforcement learning for agents, tool-use, unified memory architectures

---

### 11. SwiftMem: Fast Agentic Memory via Query-aware Indexing
- **Source URL**: https://arxiv.org/abs/2601.08160
- **Type**: Research paper (arXiv preprint, 2026-01-13)
- **Why it matters**: Achieves 47x faster search than SOTA baselines through temporal indexing (logarithmic-time range queries) and semantic DAG-Tag indexing. Introduces embedding-tag co-consolidation to address memory fragmentation during growth.
- **Key insight**: Sub-linear retrieval through specialized temporal and semantic indexing is critical for practical deployment. Current exhaustive retrieval across all stored memory is a fundamental bottleneck.
- **Connects to**: Information retrieval, indexing structures, production deployment

---

### 12. MemoryGraft: Persistent Compromise of LLM Agents via Poisoned Experience Retrieval
- **Source URL**: https://arxiv.org/abs/2512.16962
- **Type**: Security research (arXiv preprint, 2025-12-18)
- **Why it matters**: Demonstrates a novel attack where malicious "successful experiences" are implanted into agent long-term memory via benign-seeming artifacts. The agent's tendency to replicate patterns from retrieved successful tasks leads to persistent behavioral drift across sessions.
- **Key insight**: Experience-based self-improvement is a vector for stealthy, durable compromise. The trust boundary between an agent's reasoning core and its own past memories is a critical and unexplored attack surface.
- **Connects to**: AI safety, adversarial attacks, RAG poisoning, memory security

---

### 13. The AI Hippocampus: How Far are We From Human Memory?
- **Source URL**: https://arxiv.org/abs/2601.09113
- **Type**: Survey paper (arXiv preprint, 2026-01-14)
- **Why it matters**: Comprehensive taxonomy of memory in LLMs/MLLMs: implicit (in parameters), explicit (external stores), and agentic (persistent, temporally extended). Covers cross-modal memory coherence and key challenges (capacity, alignment, factual consistency, interoperability).
- **Key insight**: Memory in LLM systems spans three paradigms — implicit (weights), explicit (external), and agentic (persistent/temporal) — each with distinct tradeoffs. Multi-modal memory coherence across vision/language/audio/action is an emerging frontier.
- **Connects to**: Cognitive science parallels, multi-modal AI, memory taxonomies

---

### 14. Aeon: High-Performance Neuro-Symbolic Memory Management for Long-Horizon LLM Agents
- **Source URL**: https://arxiv.org/abs/2601.15311
- **Type**: Systems paper (arXiv preprint, 2026-01-14)
- **Why it matters**: Redefines memory as a managed OS resource with a "Memory Palace" (SIMD-accelerated spatial index) and episodic graph. Achieves sub-5μs retrieval via Semantic Lookaside Buffer, crash-recoverability via WAL, and INT8 quantization for 3.1x compression.
- **Key insight**: Agent memory benefits from OS-level systems engineering: spatial indexing, write-ahead logs, garbage collection, cache locality, and quantization. The "memory as OS resource" metaphor unlocks significant performance gains.
- **Connects to**: Systems engineering, neuro-symbolic AI, high-performance computing

---

### 15. MCMA: Learning How to Remember — Meta-Cognitive Memory Abstraction
- **Source URL**: https://arxiv.org/abs/2601.07470
- **Type**: Research paper (arXiv preprint, 2026-01-12)
- **Why it matters**: Treats memory abstraction as a learnable cognitive skill. Uses a frozen task model + learned "memory copilot" trained via DPO. Memories are organized into abstraction hierarchies for selective reuse. When no memory transfers, the ability to abstract memory itself transfers.
- **Key insight**: The meta-skill of *how* to remember is transferable even when specific memories are not. Decoupling memory management from task execution and learning memory abstraction as a separate skill enables cross-task generalization.
- **Connects to**: Meta-learning, transfer learning, cognitive science, DPO training

---

### 16. Mem-α: Learning Memory Construction via Reinforcement Learning
- **Source URL**: https://arxiv.org/abs/2509.25911
- **Type**: Research paper (arXiv preprint, 2025-09-30)
- **Why it matters**: RL framework for training agents to manage complex memory systems (core, episodic, semantic components). Despite training on ≤30k token sequences, generalizes to 400k+ tokens (13x training length). Reward signal derives from downstream QA accuracy.
- **Key insight**: RL-trained memory construction generalizes far beyond training distribution. Optimizing memory management for downstream task performance (not just retrieval accuracy) produces dramatically more robust systems.
- **Connects to**: Reinforcement learning, generalization, memory architecture design

---

### 17. Forgetful but Faithful (FiFA): Privacy-Aware Memory for Generative Agents
- **Source URL**: https://arxiv.org/abs/2512.12856
- **Type**: Research + benchmark paper (arXiv preprint, 2025-12-14)
- **Why it matters**: Introduces Memory-Aware Retention Schema (MaRS) with six forgetting policies balancing performance, privacy, and efficiency. Hybrid forgetting policy achieves 0.911 composite score. Addresses regulatory compliance and user trust.
- **Key insight**: Forgetting is as important as remembering. Privacy-preserving memory management with principled forgetting policies is essential for deployment in regulated environments. Memory budgets force useful tradeoffs.
- **Connects to**: Privacy, regulatory compliance, forgetting mechanisms, memory budgets

---

### 18. Memoria: Scalable Agentic Memory Framework for Personalized Conversational AI
- **Source URL**: https://arxiv.org/abs/2512.12686
- **Type**: Framework paper (arXiv preprint, 2025-12-14)
- **Why it matters**: Combines dynamic session-level summarization with a weighted knowledge graph for user modeling. Bridges stateless LLM interfaces and agentic memory systems for industry personalization applications.
- **Key insight**: Hybrid architecture (session summaries + weighted knowledge graph) enables both short-term dialogue coherence and long-term personalization within token constraints. Practical path from stateless to stateful agents.
- **Connects to**: Personalization, knowledge graphs, production deployment

---

### 19. DAM: Decision-Theoretic Framework for Agent Memory Management
- **Source URL**: https://arxiv.org/abs/2512.21567
- **Type**: Framework/position paper (arXiv preprint, 2025-12-25)
- **Why it matters**: Argues memory management should be viewed as sequential decision-making under uncertainty where utility is delayed. Proposes value functions and uncertainty estimators for evaluating memory operations based on long-term utility.
- **Key insight**: Memory management is a sequential decision problem with delayed rewards and uncertainty. Current heuristic approaches cannot account for the long-term, uncertain consequences of read/write decisions. Principled decision theory is needed.
- **Connects to**: Decision theory, sequential decision-making, uncertainty estimation

---

## Emerging Themes & Patterns

1. **Memory as OS Resource**: Multiple papers (AMV-L, Aeon) treat agent memory like operating system memory — with lifecycle management, tiering, eviction policies, WAL, garbage collection. This systems engineering perspective is gaining traction.

2. **Learned > Heuristic Memory Management**: Strong trend toward RL-trained or DPO-trained memory operations (AgeMem, Mem-α, MemSkill, MCMA) instead of hand-designed rules. Memory management itself is becoming a trainable skill.

3. **Graph-structured > Flat Memory**: Tree-structured (Semantic XPath), graph-based (survey), and causal graph (ActMem) approaches consistently outperform flat vector store / RAG approaches.

4. **Security as First-Class Concern**: Memory is an attack surface (MemoryGraft, AgentSys). Persistent memory creates persistent vulnerabilities. This is an underexplored but critical area.

5. **Forgetting is a Feature**: Privacy (FiFA), efficiency (AMV-L), and security (AgentSys) all motivate principled forgetting/eviction rather than unbounded accumulation.

6. **Multi-granularity Retrieval**: Dynamic scheduling between summary-level and detail-level memory based on query complexity (HyMem, AMA) outperforms fixed-granularity approaches.

7. **Benchmark Gap**: MemoryArena exposes that existing memory benchmarks don't capture the tight coupling between memory and action in real agentic settings.
