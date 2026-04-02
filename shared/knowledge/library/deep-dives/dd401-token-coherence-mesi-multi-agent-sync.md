# DD#401 — Token Coherence: Adapting MESI Cache Protocols to Minimize Synchronization Overhead in Multi-Agent LLM Systems

**Source**: arXiv:2603.15183v1 [cs.DC, cs.MA, cs.LG] — 16 Mar 2026  
**Authors**: Vladyslav Parakhin (Independent Researcher)  
**Deep-Dive Date**: 2026-03-17  
**Relevance**: ★★★★★ CRITICAL — directly addresses multi-agent coordination infrastructure with formal rigor

---

## 1. Problem Statement

Multi-agent LLM systems suffer from what the author calls **"broadcast-induced triply-multiplicative overhead"**: when any shared artifact is modified, the orchestrator rebroadcasts its full contents to every subscribing agent at the next synchronization boundary. The cost scales as **O(n × S × |D|)** in agents, steps, and artifact size.

**Concrete example**: 5 agents, 50 reasoning steps, one 8,192-token planning document → 2,048,000 tokens, "the vast majority of which is unchanged context, retransmitted without necessity."

This isn't just a cost problem — it's a capability problem:
- Token budget constraints force practitioners to truncate reasoning traces, compress artifacts, cull agent populations
- Cemri et al.'s MAST analysis of 1,642 execution traces across 7 production MAS frameworks reports **41%–86.7% task failure rates**
- Inter-agent misalignment (including FM-1.4: Loss of Conversation History from context truncation) accounts for **32.3% of observed failures**
- Empirical benchmarking reports **86% token duplication rates** in flat topologies, 72% in linear topologies

## 2. Core Insight: The Cache Coherence Analogy

The paper's central claim: **the synchronization cost explosion in multi-agent LLM systems maps formally onto the cache coherence problem in shared-memory multiprocessors**, and the canonical hardware remedy — **MESI protocol invalidation** (Papamarcos & Patel 1984) — transfers to the artifact synchronization domain.

### Structural Mapping

| CPU Memory Hierarchy | Agent Memory Hierarchy | Coherence Mechanism |
|---|---|---|
| L1/L2 cache (per-core) | Agent artifact cache (per-agent) | MESI state per agent-artifact pair |
| Shared LLC / main memory | Shared artifact store (authority) | Canonical version + invalidation events |
| Memory bus / coherence fabric | Event bus (Redis/Kafka/NATS) | Invalidation and version-update messages |
| Disk / persistent storage | Long-term persistence (vector DB) | Out of scope for CCS v0.1 |

### The Always-Read Objection — And Its Refutation

The paper confronts the strongest counter-argument head-on: "LLM agents consume their entire context window at every forward pass, so lazy invalidation is useless."

**Response**: This describes naive single-turn prompt construction only. Modern production architectures use **conditional artifact access semantics** where R(a,s) ⊊ D:

1. **Tool-based retrieval** — LangChain/OpenAI Assistants use get_document(), read_file() tools; system prompts carry artifact *identifiers*, not *contents*
2. **MCP resource access** — Artifacts are external resources (resource://shared_plan); injection occurs only upon explicit request, costing O(1) tokens for the reference
3. **Vector retrieval** — RAG stores inject only top-k fragments, not full artifacts
4. **Provider-side prompt caching** — Anthropic/OpenAI/Google cache prompt prefixes; high cache hit rates in production are indirect evidence that artifacts are *not* re-embedded every step

## 3. Formal Model: Artifact Coherence System (ACS)

### Definition

ACS = ⟨A, D, Σ, δ, α, T⟩ where:
- A = {a₁,...,aₙ} — finite set of agents
- D = {d₁,...,dₘ} — finite set of shared artifacts (≡ cache lines)
- Σ = {M, E, S, I} — stable artifact coherence states
- δ: Σ × E → Σ — state transition function (events: read, write, upgrade, fetch, invalidate, commit)
- α: A × D → Σ — coherence state function (per agent-artifact pair)
- T: Σ → {0,1} — validity predicate (T(I) = 0, T(M/E/S) = 1)

### MESI State Mapping φ

The mapping is the **identity function** on {M, E, S, I}:

| State | Semantic in Agent Domain |
|---|---|
| Modified (M) | Agent holds only valid copy; authority copy stale; peers invalidated |
| Exclusive (E) | Agent holds only copy, identical to authority; write permitted without broadcast |
| Shared (S) | Multiple agents hold valid copies; no agent has written since last commit |
| Invalid (I) | Agent's cached copy stale; full fetch required before next use |

**Proposition 1 (Structural Equivalence)**: The ACS transition system is isomorphic to the MESI hardware transition system under φ at the *stable-state level*. Every safety result that holds for MESI under SWMR holds for ACS.

**Critical caveat the author foregrounds**: The isomorphism holds at stable states only. Transient-state behavior of hardware MESI (race conditions on bus fabric) maps only *approximately* to asynchronous event-bus semantics. The author explicitly acknowledges this as a non-trivial gap, though argues it doesn't undermine practical utility since the protocol operates at quiescent-state granularity.

## 4. The Token Coherence Theorem

### Broadcast Cost Baseline
T_broadcast = n × S × Σᵢ|dᵢ|

### Coherent Synchronization Cost Upper Bound
T_coherent ≤ Σᵢ n·(n + W(dᵢ)) × |dᵢ|

where W(dᵢ) = total write operations to artifact dᵢ across all agents and steps.

### Theorem 1 (Savings Lower Bound)
For uniform artifact sizes:

**Savings ≥ 1 − (n + W(dᵢ))/S**

The condition for positive savings: **S > n + W(dᵢ)** for most artifacts.

### Artifact Volatility Factor
V(dᵢ) = W(dᵢ)/S ∈ [0,1]

Substituting: **Savings ≥ 1 − n/S − V(dᵢ)**

For typical parameters (n=4, S=40, V=0.05): Lower bound = **85%**

### Volatility Cliff
V* = 1 − n/S — above this, coherence savings collapse.
- n=4, S=40: V* = 0.9
- n=5, S=20: V* = 0.75

### Complexity Transformation
- Broadcast: **O(n × S × |D|)** — triply multiplicative
- Coherent: **O(n(n+W) × |D|)** — the S multiplier is eliminated

## 5. CCS Protocol: TLA+-Verified

### System Architecture
- **Authority Service**: Global artifact directory (version numbers, per-agent coherence state)
- **Agent Runtime**: Local artifact cache with content, version, MESI state
- **Event Bus**: Invalidation propagation (Redis PubSub / Kafka / NATS / WebSockets)
- **Artifact Store**: Canonical artifact versions, serves fetch requests

### Protocol Operations
1. **Read**: Check α(a,dᵢ). If valid (M/E/S) → zero tokens transmitted. If I → fetch from authority, transition to S
2. **Upgrade**: To write while holding S → acquire exclusive ownership via UPGRADE_REQUEST, authority invalidates peers, grants E
3. **Write**: Once E → write locally, transition to M. Zero tokens broadcast during local writes
4. **Commit**: Send new content + incremented version to authority → transition to S, broadcast VERSION_UPDATE
5. **Invalidation**: Authority sends INVALIDATE on upgrade grant; agents set cache to I. Idempotent.

### Synchronization Strategies (Pluggable)
1. **Eager invalidation** — invalidate on upgrade grant (min staleness, max traffic)
2. **Lazy invalidation** (recommended default) — invalidate only on commit (batches cost)
3. **Lease-based TTL** — entries expire on timer
4. **Access-count invalidation** — entries transition to I after k uses

### Lease TTL Recovery
Agent crash while holding M state → authority lease timer τ (default 30s) → orphaned lock reverted. The author notes sensitivity: slow LLM inference can race with lease expiration, causing valid writes to be reverted.

### TLA+ Verification
Three invariants verified across ~2,400 states (3 agents, 1 artifact):

1. **SWMR (Single-Writer/Multiple-Reader)**: No two agents simultaneously hold M state
2. **Monotonic Versioning**: artifactVersion never decreases
3. **K-Bounded Staleness**: No agent operates on artifact version lagging canonical by more than K writes

**Counterexample constructed**: Removing invalidation from Upgrade allows two agents to simultaneously hold M state, violating SWMR.

### Consistency Model
**Bounded-staleness coherence**: Weaker than sequential consistency (which mandates reads observe most recent write), stronger than eventual consistency (which provides no staleness bound). The K parameter makes staleness budget explicit and configurable.

## 6. Simulation Results

Tick-based discrete event simulation, 4 agents, 40 steps, 3 artifacts (4096 tokens each), 10 runs per configuration:

| Volatility (V) | Theory Lower Bound | Observed Savings (Lazy) | Std Dev |
|---|---|---|---|
| 0.05 | 85% | **95.0%** | ±1.3% |
| 0.10 | 80% | **92.3%** | ±1.4% |
| 0.25 | 65% | **88.3%** | ±1.5% |
| 0.50 | 40% | **84.2%** | ±1.3% |
| 0.90 | ~0% (cliff) | **~81%** | — |

**Key finding**: At V=0.9 (near the volatility cliff), the theory predicts savings collapse to ~0%, but simulation shows ~81% savings persist because lazy deferred-fetch accumulation prevents worst-case collapse from materializing. The gap between analytical bound and observed savings ranges from **10 to 45 percentage points** depending on workload.

### Practical Implication
For the motivating example (5 agents, 50 steps, 8192-token document):
- Broadcast: 2,048,000 tokens
- With coherence (V=0.05): ~102,400 tokens → **~95% reduction**

## 7. Framework Integration

Reference Python implementation (agent-coherence v0.1) with adapter layers for:
- **LangGraph**: Thin wrapper around state graph nodes
- **CrewAI**: Hooks into task/agent lifecycle
- **AutoGen**: Message-level interception

No framework modifications required — adapters intercept artifact access at the orchestration boundary.

## 8. Synthesis Connections

### Connection to DD#391 (Language Model Teams as Distributed Systems)
DD#391 applied distributed systems concepts to MAS. Token Coherence pushes this further by importing a *specific* hardware protocol (MESI) with formal proofs. Where DD#391 was conceptual mapping, this is operational protocol with TLA+ verification.

### Connection to DD#389 (Agentic Pressure & Normative Drift)
The cost pathology Token Coherence addresses is a root cause of the pressure dynamics DD#389 identifies. When token budgets force context truncation, agents lose conversation history → normative drift. Coherence eliminates the cost driver.

### Connection to DD#400 (Cross-Domain Multi-Agent Synthesis)
Validates the synthesis finding that "multi-timescale decomposition" and "hardware-inspired coordination" patterns recur across domains. MESI-to-MAS is the strongest example yet of cross-domain architectural transfer.

### Connection to DD#376 (Cascading Risk in Multi-Agent Systems)
The bounded-staleness invariant (K-bounded) provides a formal mechanism to prevent the stale-state cascading failures identified in DD#376.

### Broader Pattern: Architecture Transfer Direction
Hardware → Software coordination transfer has historical precedent (distributed databases adopted consistency models from hardware). This paper makes the transfer *explicit and formal* for the first time in the MAS domain.

## 9. Limitations & Open Questions

1. **Stable-state only**: Transient-state correspondence to hardware MESI not formalized — a non-trivial gap
2. **Simulation only**: No real-world multi-agent deployment evaluation; simulation uses tick-based discrete events, not actual LLM inference
3. **Conditional access assumption**: The formal argument depends on R(a,s) ⊊ D — if agents truly embed all artifacts inline, savings vanish
4. **Small-scale TLA+ verification**: 3 agents only; n=10+ not verified due to state explosion
5. **Lease TTL tuning**: No principled method for setting τ; slow inference can race with expiration
6. **Single artifact store**: No replication/partitioning of authority service
7. **Full-artifact transmission**: No delta/diff transmission modeled; sub-artifact coherence could compound savings
8. **Independent researcher**: Single author, no institutional affiliation — warrants careful scrutiny but the formalism is rigorous

## 10. Key Takeaways for Multi-Agent System Design

1. **The dominant cost in MAS is synchronization, not generation** — 86% token duplication in flat topologies
2. **Full-state rebroadcast is a design choice, not a necessity** — it can be replaced with invalidation-based coherence
3. **MESI maps cleanly to agent-artifact coordination** — the 4-state model (M/E/S/I) provides a complete framework
4. **Token savings of 84-95% are achievable** for typical workloads (V ≤ 0.5)
5. **The analytical bound is conservative** — lazy invalidation consistently outperforms theory by 10-45 percentage points
6. **Bounded staleness > eventual consistency** — the K parameter makes the consistency-cost tradeoff explicit
7. **Framework integration requires no modifications** — adapter-layer architecture is sufficient

## 11. Relevance Rating Justification

★★★★★ CRITICAL because:
- Directly addresses the #1 operational cost driver in multi-agent LLM systems
- Provides formally verified protocol (not just conceptual framework)
- 84-95% token savings with rigorous lower bounds
- Integrates with all major orchestration frameworks
- Bridges hardware systems and AI coordination with unprecedented formalism
- Immediately actionable for any team running multi-agent deployments
