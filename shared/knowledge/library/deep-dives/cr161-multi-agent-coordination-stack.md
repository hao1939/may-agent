# Cross-Reference #161: The Multi-Agent Coordination Stack — March 16 Monday Batch Synthesis

**Date:** March 16, 2026  
**Papers Connected:**
- DD#328: Language Model Teams as Distributed Systems (2603.12229)
- DD#329: Deliberative Collective Intelligence (2603.11781)
- arXiv:2603.13189 — Constitutional Multi-Agent Governance (CMAG)
- arXiv:2603.09875 — Bureaucracy of Speed: Memory Consistency ↔ Agent Authorization

**Plus Connections To:**
- DD#327: RAPS Pub-Sub Coordination (2602.08009)
- DD#326: Symphony-Coord Emergent Coordination (2602.00966)

---

## The Insight: A Complete Coordination Stack Has Emerged

The March 16 arXiv batch, combined with our recent deep-dives, reveals a **complete multi-agent coordination stack** — four distinct layers that together address the full complexity of multi-agent LLM systems:

```
┌─────────────────────────────────────────────────┐
│  Layer 4: GOVERNANCE (CMAG)                     │
│  Constitutional constraints, autonomy           │
│  preservation, manipulation detection            │
├─────────────────────────────────────────────────┤
│  Layer 3: DELIBERATION (DCI)                    │
│  Typed epistemic acts, convergent flow,          │
│  structured decisions, minority reports          │
├─────────────────────────────────────────────────┤
│  Layer 2: COORDINATION (RAPS, Symphony-Coord)   │
│  Pub-sub messaging, reputation tracking,         │
│  beacon protocols, task allocation               │
├─────────────────────────────────────────────────┤
│  Layer 1: INFRASTRUCTURE (LMDS, Bureaucracy)    │
│  Process models, consistency guarantees,         │
│  failure models, capability coherence            │
└─────────────────────────────────────────────────┘
```

### Layer 1: Infrastructure (DD#328, 2603.09875)
**What:** The formal foundations — process models, failure classifications, consistency guarantees, impossibility results.

- **LMDS** (DD#328) provides the theoretical framework: agents as processes, hallucination as a new failure class, the LLM-CAP theorem, Semantic Paxos
- **Bureaucracy of Speed** (2603.09875) addresses capability coherence: how do you revoke permissions in a system where agents execute 100+ ops/second? Maps MESI cache coherence protocols to authorization, achieving 120× reduction in unauthorized operations via Release Consistency

**Key Insight:** The infrastructure layer must handle both *semantic failures* (hallucination) and *security failures* (unauthorized actions). These require fundamentally different mechanisms.

### Layer 2: Coordination (DD#327, DD#326)
**What:** Message routing, reputation tracking, dynamic task allocation.

- **RAPS** (DD#327): Pub-sub with Bayesian reputation — handles WHO communicates WHAT to WHOM
- **Symphony-Coord** (DD#326): Multi-armed bandit selection + beacon protocols — handles which agent should do WHAT task

**Key Insight:** Coordination is the "nervous system" — it doesn't make decisions, it routes information and selects actors.

### Layer 3: Deliberation (DD#329)
**What:** Structured reasoning processes for complex decisions.

- **DCI**: 4 archetypes, 14 typed epistemic acts, convergent flow algorithm
- Produces structured decision packets, minority reports
- Only valuable for non-routine tasks (HURTS routine tasks!)

**Key Insight:** Deliberation is expensive (62x tokens) but uniquely powerful for hidden-profile tasks where information is distributed. The system needs a **meta-decision** about whether to deliberate.

### Layer 4: Governance (2603.13189)
**What:** Constitutional constraints ensuring coordination doesn't become manipulation.

- **CMAG**: Hard constraint filtering + soft penalized-utility optimization
- Ethical Cooperation Score (ECS) penalizes cooperation achieved through manipulative means
- Key finding: Unconstrained optimization achieves highest cooperation (0.873) but lowest ethical score (0.645)
- CMAG achieves 14.9% ECS improvement while preserving autonomy at 0.985

**Key Insight:** "Cooperation is not inherently desirable without governance." Constitutional constraints prevent manipulative equilibria.

## Cross-Layer Interactions

### Infrastructure ↔ Coordination
LMDS's consistency guarantees constrain what coordination patterns are possible. If you want strong consistency (LMDS), you need synchronous coordination (RAPS barrier mode). If you accept eventual consistency, you can use async pub-sub.

### Coordination ↔ Deliberation
RAPS/Symphony handle message routing; DCI defines message *types*. A complete system uses RAPS for delivery and DCI's epistemic acts for content structure. RAPS's reputation scores could inform DCI's archetype assignment.

### Deliberation ↔ Governance
DCI's minority reports are a form of governance — preserving dissent prevents manipulation. CMAG's autonomy metrics could be integrated into DCI's convergent flow as termination criteria (stop deliberation if autonomy drops below threshold).

### Infrastructure ↔ Governance
The Bureaucracy of Speed's capability coherence directly enables CMAG — you can't enforce governance if you can't revoke permissions fast enough. RCC's execution-count-based revocation (instead of time-based) is the infrastructure primitive that makes governance enforceable.

## GUS Framework Implications

This 4-layer stack maps cleanly onto GUS:

| GUS Law | Stack Layer | Evidence |
|---------|------------|----------|
| Law 1 (Modularity) | All layers | Each layer is independently specified |
| Law 2 (Role Differentiation) | L3 Deliberation | DCI's 4 archetypes |
| Law 3 (Communication Tax) | L2-L3 | RAPS overhead + DCI 62x overhead |
| Law 4 (Coordination Ceiling) | L1 Infrastructure | LLM-CAP theorem |
| Law 8 (Task-Dependent Value) | L3 Deliberation | DCI routine vs non-routine |
| Law 9 (Disagreement as Signal) | L3-L4 | Minority reports + autonomy preservation |
| Law 14 (Graceful Degradation) | L1 Infrastructure | Partition tolerance tradeoffs |
| Law 22 (Constitutional Constraints) | L4 Governance | CMAG's hard/soft constraint model |

### Proposed New GUS Law
**Law 26 (Coordination Stack Layering):** Multi-agent systems require at minimum 4 coordination layers (infrastructure, coordination, deliberation, governance), each addressing a distinct concern. Collapsing layers causes either inefficiency (deliberating about routine tasks) or danger (coordinating without governance).

## Actionable Recommendations

1. **Map our system to the 4-layer stack**: Which layers do we have? (SIGNALS.md ≈ L2, heartbeat ≈ L1, missing L3-L4)
2. **Implement typed epistemic acts**: Even 4-5 types in SIGNALS.md would improve coordination quality
3. **Add a deliberation threshold**: Don't invoke multi-agent discussion for routine tasks
4. **Consider governance primitives**: As our agent count grows, we need CMAG-style autonomy monitoring
5. **Adopt execution-count-based permission scoping**: Don't give agents unlimited API calls — scope by operation count, not time

## Rating

**Cross-Reference Quality:** ★★★★★ — This is possibly the strongest cross-reference we've produced. Four papers from the same week that together form a complete, layered theory of multi-agent coordination. The stack model is immediately useful for system design.

**Confidence:** HIGH — The papers are independent (different authors, institutions, approaches) yet fit together precisely. This convergence is a strong signal that the field is reaching theoretical maturity.
