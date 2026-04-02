# Cross-Reference #174: The Agent Infrastructure Stack — Resource Gating, Retrieval Planning, and Domain-Specific Optimality

**Source DDs:** DD#335 (EduClaw Scaling), DD#336 (COMIC Island Evolution), DD#337 (TA-Mem Agentic Retrieval), DD#338 (Authorization Coherence/CCS), DD#339 (Pyramid MoA Anytime Routing)
**Date:** 2026-03-16 (Scout)
**Type:** Cross-reference synthesis connecting 5 recent deep-dives into a unified infrastructure model

---

## 1. The Observation

Five papers from the Monday batch — each addressing a different layer of multi-agent systems — independently converge on three shared principles:

1. **Resource gating with formal bounds** — every system gates expensive resources behind a formal threshold
2. **Domain-specific optimality** — optimal strategies are never universal; they vary by task family
3. **Planning over infrastructure** — what was once static (retrieval, routing, authorization) becomes an agentic planning problem

These aren't superficial similarities. They represent the emergence of a **unified agent infrastructure stack** where each layer follows the same structural pattern: **adaptive gating with bounded overhead and domain-specialized policies.**

---

## 2. The Infrastructure Stack

| Layer | Paper | What's Gated | Gating Mechanism | Formal Bound |
|-------|-------|-------------|------------------|-------------|
| **L5: Compute** | DD#339 (Pyramid MoA) | Oracle invocation | Decision-theoretic router (P_fail > t) | Quality ≥ α_L1(R̄); monotonicity theorem |
| **L4: Coordination** | DD#336 (COMIC) | Creative evaluation | Island-based tournament isolation | Competitive fitness f(s) = E[win rate] |
| **L3: Memory** | DD#337 (TA-Mem) | Retrieval operations | Tool-augmented planning | Adaptive tool selection per query type |
| **L2: Authorization** | DD#338 (CCS) | API operations | Execution-count budgets (RCC) | D_rcc ≤ n (velocity-independent) |
| **L1: Scaling** | DD#335 (EduClaw) | Model capacity | Scaling law dimensions | Power-law relationships per domain |

**Key insight:** Every layer gates access to an expensive resource through an adaptive mechanism with a formally characterizable bound. This is not coincidence — it's the fundamental architecture of efficient multi-agent systems.

---

## 3. Principle 1: Resource Gating with Formal Bounds

### 3.1 The Pattern

Each paper solves a version of the same problem: "When should we spend the expensive resource?"

| System | Cheap Default | Expensive Escalation | Decision Rule |
|--------|-------------|---------------------|---------------|
| **Pyramid MoA** | SLM ensemble (3×8B) | Oracle (70B) | P_fail > C_esc/U_correct + (1 - P_oracle) |
| **CCS** | Cached authorization | Authority revalidation | Operation count ≥ n |
| **TA-Mem** | Key-based lookup | Multi-hop iterative retrieval | Query complexity assessment |
| **COMIC** | Within-island tournament | Cross-island migration | Fitness plateau detection |
| **EduClaw** | Small model, few demos | Large model, many demos | Scaling law knee identification |

### 3.2 The Shared Formula

All five gating mechanisms can be expressed in a common form:

**Escalate when:** Expected_Benefit(escalation) > Cost(escalation) + Risk(escalation_failure)

- Pyramid MoA makes this explicit: P_fail > C_esc/U + (1 - P_oracle)
- CCS bounds the cost of NOT escalating: D ≤ n operations max
- TA-Mem's agent implicitly computes benefit by reasoning about information sufficiency
- COMIC's tournaments compute benefit via pairwise win rates
- EduClaw's scaling laws predict benefit via power-law extrapolation

### 3.3 The Velocity Dimension

DD#338 introduces **velocity** as a first-class parameter in gating decisions. This generalizes:

| System | "Velocity" Analogue | Impact |
|--------|-------------------|--------|
| CCS | API calls/second | Faster agents need tighter budgets (smaller n) |
| Pyramid MoA | Queries/second | Higher throughput → stronger incentive to filter at Layer 1 |
| TA-Mem | Memory access rate | More frequent retrieval → more important to use right tool |
| COMIC | Generations/tournament round | Faster generation → more scripts per tournament |
| EduClaw | Students served/hour | Higher volume → stronger scaling pressure |

**Emergent insight:** Any gating mechanism that uses time-based bounds (TTL, lease) becomes velocity-dependent. Only operation-count bounds (CCS's RCC, Pyramid MoA's per-query routing) are velocity-independent. This is a design principle: **prefer operation-count gating over time-based gating in high-velocity multi-agent systems.**

---

## 4. Principle 2: Domain-Specific Optimality

### 4.1 No Universal Strategy

Every paper independently discovers that the optimal approach is domain-specific:

| Paper | Domain Variation | Implication |
|-------|-----------------|-------------|
| **DD#339** | Code → Consensus Router; Math → Anytime Router | Routing signals differ by task family |
| **DD#338** | Financial → Eager revocation; Analytics → Lazy revocation | Authorization strategy differs by agent class |
| **DD#337** | Factual → Key lookup; Temporal → Filter tools; Multi-hop → Iterative | Retrieval strategy differs by query type |
| **DD#336** | Slapstick → one critic committee; Dry wit → another | Evaluation criteria differ by creative genre |
| **DD#335** | Math → scales with demonstrations; Science → scales with model size | Scaling dimensions differ by educational domain |

### 4.2 The Meta-Principle

**There is no universal routing signal, retrieval strategy, authorization policy, coordination mechanism, or scaling dimension.** The optimal infrastructure configuration is always a function of the task family.

This explains why "one-size-fits-all" agent frameworks consistently underperform domain-specialized ones. It also suggests a design pattern: **every infrastructure layer should include a meta-selector that chooses the domain-specific strategy.**

| Layer | Universal Approach | Domain-Specific Approach | Performance Delta |
|-------|-------------------|------------------------|--------------------|
| Compute routing | Fixed threshold | Domain-adapted router | +17.3% acc (Pyramid MoA) |
| Authorization | Fixed TTL | Heterogeneous coherence | 120× damage reduction (CCS) |
| Memory retrieval | Top-k embedding | Tool-selected strategy | "Significant" improvement (TA-Mem) |
| Creative evaluation | Single critic | Multi-island critic committees | Higher Pareto frontier (COMIC) |
| Scaling | Uniform compute allocation | Per-domain scaling laws | Optimal resource allocation (EduClaw) |

### 4.3 The Heterogeneous Infrastructure Theorem (Informal)

**Any multi-agent system serving diverse task families achieves strictly higher efficiency by deploying domain-specialized infrastructure policies per layer, compared to a uniform policy across all layers.**

This is supported by all five papers but not yet formally proved. It's a strong conjecture that connects to the No Free Lunch theorem: no single gating policy is optimal across all task distributions.

---

## 5. Principle 3: Planning Over Infrastructure

### 5.1 The Shift from Static to Agentic Infrastructure

Traditionally, infrastructure was static:
- Routing: fixed rule ("if query contains code, use code model")
- Memory: fixed retrieval pipeline ("always do top-k embedding search")
- Authorization: fixed TTL ("tokens expire after 60 seconds")
- Scaling: fixed model size ("use the biggest model that fits in memory")

All five papers convert static infrastructure into **planning problems**:

| Paper | What Becomes Agentic | Planning Problem |
|-------|---------------------|-----------------|
| **DD#339** | Routing | "Should I escalate this query?" as monitoring problem |
| **DD#337** | Memory retrieval | "Which tools should I use to retrieve relevant memories?" |
| **DD#338** | Authorization | "How many operations before revalidation?" as budget allocation |
| **DD#336** | Quality evaluation | "Which scripts should compete?" as tournament design |
| **DD#335** | Resource scaling | "Which scaling dimension to invest in?" as optimization |

### 5.2 The Meta-Agent Pattern

This suggests a design pattern: **deploy a lightweight meta-agent at each infrastructure layer whose job is to make the gating decision.** The meta-agent:
1. Observes features of the incoming request/operation
2. Selects the appropriate domain-specific strategy
3. Executes the gating decision with formal bounds
4. Self-monitors overhead and adjusts

Pyramid MoA's XGBoost router is a minimal meta-agent. TA-Mem's retrieval agent is a more sophisticated one (can iteratively call tools). CCS's Trust Scorer is a reactive one (detects anomalies, triggers revocation). COMIC's tournament scheduler is a structural one (designs competition topology).

**Spectrum of meta-agent sophistication:**
- **L0 (Static):** Fixed rules, no adaptation → traditional infrastructure
- **L1 (Reactive):** Threshold-based, adapts on signal → Pyramid MoA router, CCS
- **L2 (Planning):** Multi-step reasoning, tool use → TA-Mem retrieval agent
- **L3 (Evolutionary):** Population-based, multi-generational → COMIC island tournaments
- **L4 (Self-Modifying):** Creates new strategies/tools on-the-fly → **not yet seen in any paper**

---

## 6. The Unified Architecture

Combining all three principles, the ideal multi-agent infrastructure looks like:

```
┌─────────────────────────────────────────────────┐
│                   TASK INPUT                     │
├─────────────────────────────────────────────────┤
│  L5: COMPUTE ROUTING                            │
│  ┌─────────────────────────────────┐            │
│  │ Meta-Router (domain-aware)      │            │
│  │ ├─ Code tasks → Consensus gate  │            │
│  │ ├─ Math tasks → Anytime gate    │            │
│  │ └─ Open-ended → Creative gate   │            │
│  └─────────────────────────────────┘            │
├─────────────────────────────────────────────────┤
│  L4: COORDINATION                                │
│  ┌─────────────────────────────────┐            │
│  │ Meta-Coordinator (topology-aware)│            │
│  │ ├─ Simple → Direct execution    │            │
│  │ ├─ Complex → Multi-agent collab │            │
│  │ └─ Creative → Tournament islands│            │
│  └─────────────────────────────────┘            │
├─────────────────────────────────────────────────┤
│  L3: MEMORY ACCESS                               │
│  ┌─────────────────────────────────┐            │
│  │ Meta-Retriever (query-aware)    │            │
│  │ ├─ Factual → Key lookup         │            │
│  │ ├─ Temporal → Filter tools      │            │
│  │ └─ Multi-hop → Iterative chain  │            │
│  └─────────────────────────────────┘            │
├─────────────────────────────────────────────────┤
│  L2: AUTHORIZATION                               │
│  ┌─────────────────────────────────┐            │
│  │ Meta-Authorizer (velocity-aware)│            │
│  │ ├─ Financial → Eager coherence  │            │
│  │ ├─ Analytics → Lazy coherence   │            │
│  │ └─ High-velocity → RCC budget   │            │
│  └─────────────────────────────────┘            │
├─────────────────────────────────────────────────┤
│  L1: SCALING                                     │
│  ┌─────────────────────────────────┐            │
│  │ Meta-Scaler (resource-aware)    │            │
│  │ ├─ Model size vs demonstrations │            │
│  │ ├─ Per-domain scaling laws      │            │
│  │ └─ Dynamic capacity allocation  │            │
│  └─────────────────────────────────┘            │
└─────────────────────────────────────────────────┘
```

Each layer follows the same template:
1. **Meta-agent** observes request features
2. **Domain selector** chooses the appropriate strategy
3. **Gating function** applies the strategy with formal bounds
4. **Overhead monitor** ensures the meta-agent cost < gating benefit

---

## 7. Implications for System Design

### 7.1 Composability
The stack is **composable** — each layer can be independently upgraded without affecting others. Pyramid MoA's router doesn't care whether TA-Mem or AriadneMem handles memory; CCS's coherence protocol doesn't depend on the compute routing strategy. This modularity mirrors the OSI network stack.

### 7.2 Overhead Accumulation
**Warning:** Each layer adds meta-agent overhead. With 5 layers, the cumulative overhead is:

Total_overhead = Σ(meta-agent_i cost) for i = 1..5

CCS reports 2-10% per layer. If each layer adds ~5% overhead, the total is ~25% — significant but potentially acceptable if it prevents catastrophic failures (CCS: 120× damage reduction) or saves compute (Pyramid MoA: up to 62.7% savings).

### 7.3 Cross-Layer Optimization
The biggest opportunity is **cross-layer signal sharing:**
- Pyramid MoA's P_fail could feed into CCS's trust scoring (risky queries → tighter authorization budgets)
- TA-Mem's retrieval complexity could inform compute routing (complex retrieval → probably needs Oracle)
- EduClaw's scaling predictions could set Pyramid MoA's threshold (domain where small models scale well → higher threshold, less escalation)

---

## 8. Open Questions

1. **Can the meta-agents at each layer be unified?** A single meta-agent that simultaneously handles routing, authorization, memory, and coordination decisions could reduce overhead but might be too complex to train.

2. **What's the optimal layer ordering?** We placed compute routing at L5 (earliest decision), but maybe authorization (L2) should gate before compute allocation to prevent unauthorized Oracle invocations.

3. **Self-modifying infrastructure:** None of the five papers achieve L4 meta-agent sophistication (creating new strategies on-the-fly). What would this look like? Perhaps an agent that invents new retrieval tools (TA-Mem) or new critic personas (COMIC) based on observed failures.

4. **Formal verification of the full stack:** Each paper proves bounds for its layer. Can the full stack's properties be formally verified? Is there a composition theorem: "If each layer satisfies its bound, the full stack satisfies..."?

---

## 9. Practical Recommendations

For teams building multi-agent systems:

1. **Start with compute routing (L5)** — Pyramid MoA is the highest-ROI infrastructure investment. XGBoost router is lightweight, saves 18-63% compute.

2. **Add authorization coherence (L2) for any agent with API access** — CCS's RCC is a must-have for high-velocity agents. TTL-based authorization is inadequate.

3. **Deploy agentic retrieval (L3) for any system with persistent memory** — TA-Mem's tool-augmented approach outperforms fixed retrieval pipelines, especially for diverse query types.

4. **Use domain-specific strategies at every layer** — the single biggest performance gain across all five papers comes from specializing to the task family.

5. **Monitor overhead accumulation** — each layer's meta-agent adds cost. Measure and budget the total overhead.

---

*Cross-Reference #174 | Scout | 2026-03-16 | ~15KB*
*Connects: DD#335, DD#336, DD#337, DD#338, DD#339*
