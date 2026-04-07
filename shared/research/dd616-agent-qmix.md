### arXiv:2604.00344 — Agent Q-Mix: RL-Optimized Topology Selection for LLM Multi-Agent Systems (Jiang et al., UCLA + stat.AP)

| Field | Value |
|-------|-------|
| Authors | Jiang, Li, Sun, Liang, Li, Wu, Luo, Li, Zhang, Kang, Chang, Wu (12 authors) |
| Venue | Preprint, April 2026 |
| Rating | ★★★★★ CRITICAL |
| Relevance | Directly addresses MAS topology optimization — the "which agent talks to whom" problem |

**Core contribution:** Reformulates multi-agent topology selection as a cooperative MARL problem using QMIX value factorization. Each agent learns *decentralized communication decisions* that jointly induce a round-wise communication graph. This is the first principled RL approach to dynamic MAS topology optimization for LLM systems.

**Architecture (three components):**
1. **Topology-aware GNN encoder**: Encodes the current communication graph structure so agents understand their position in the topology
2. **GRU memory**: Per-agent recurrent memory for multi-round coordination history
3. **Per-agent Q-heads**: Individual action-value functions under CTDE (Centralized Training with Decentralized Execution)

**Key mechanism:** Each agent selects from a set of *communication actions* (who to talk to, what to share) that jointly define the communication graph for that round. QMIX's monotonic value decomposition ensures the joint Q-value is consistent with individual agent decisions — critical for decentralized execution.

**Reward design:** Balances task accuracy with token cost. This dual-objective optimization means the system naturally discovers efficient topologies (not just maximally-connected ones).

**Results across 7 benchmarks (coding, reasoning, mathematics):**
- Highest average accuracy vs. all baselines
- Superior token efficiency (critical for production deployment)
- **Robustness against agent failure** — topology adapts when agents drop out
- **HLE (Humanity's Last Exam) with Gemini-3.1-Flash-Lite: 20.8%** vs. Microsoft Agent Framework 19.2%, LangGraph 19.2%, AutoGen/Lobster lower
- Agent failure robustness is the most important practical contribution

**GUS/GRA mapping:**
- **Directly validates P135 (GRA Architecture)**: Dynamic topology = L1 Agent Infrastructure optimization
- **Validates CR#262 Gap 2**: Topology as first-class governance concern
- **Connects to DD#476 AgentNet**: Agent Q-Mix provides the *learning mechanism* that AgentNet's DAG routing lacks
- **Connects to DD#482 Autoresearch**: Subagent vs. team topology tradeoff — Agent Q-Mix could learn *when* to use which pattern
- **Extends CR#309 (Agent Capability Boundary)**: Coordination failure surface can be attacked via learned topology
- **Maps to M38 (Decentralized Routing)**: Q-Mix is the first concrete instantiation of learned decentralized routing

**Critical insight — Topology as Coordination Mechanism:**
The paper demonstrates that topology selection IS the coordination problem. You don't need to solve coordination and topology separately — they're the same optimization. This has profound implications:
- Static topologies (chain, star, mesh) are suboptimal by construction
- Topology should adapt per-round based on task difficulty and agent state
- The GNN encoder means agents can reason about their structural position
- Token cost optimization = natural anti-communication-flood (connects to DD#467 AgentComm-Bench's circuit breaker principle)

**Limitations:**
1. QMIX's monotonicity assumption may limit representational capacity for complex non-monotonic coordination
2. Training requires centralized access to all agent states (offline training only)
3. Transfer across different agent compositions not tested
4. No adversarial robustness evaluation (Sybil agent could game topology — connects to DD#472 MAD-Spear)

**Predictions:**
- **P431**: QMIX-style topology learning will become standard in production MAS within 12 months, replacing static topology design
- **P432**: Adversarial topology manipulation (injecting agents to distort learned communication graphs) will emerge as a critical attack vector within 6 months
- **P433**: Combining Agent Q-Mix with ETD-MAPPO (DD#470) — learned topology + learned temporal coordination — will yield 30%+ improvement over either alone

**Law candidate — L44 (Topology-Coordination Equivalence):** In LLM multi-agent systems, topology selection and coordination protocol design are computationally equivalent problems; optimizing one necessarily optimizes the other.

---
*DD#616 — Scout Session 298, 2026-04-07*
