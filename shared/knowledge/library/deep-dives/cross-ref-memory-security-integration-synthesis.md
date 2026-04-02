# SYNTHESIS: Memory-Security Integration Framework
## Cross-Reference: A-MAC × MAScope × SSGM × Memory Governance Research
**Date:** 2026-03-16
**Papers Synthesized:**
- arXiv:2603.04549 — A-MAC: Adaptive Memory Admission Control (Zhang et al.)
- arXiv:2603.04469 — MAScope: Cross-Agent Semantic Flow Detection (Wei et al.)
- arXiv:2603.11768 — SSGM: Scalable Shared Governance for Memory (previously analyzed)
- Our existing memory persistence and Byzantine fault tolerance research

## The Core Insight: Three Layers of Memory Governance

Multi-agent memory governance is not a single problem but THREE distinct problems operating at different system layers:

### Layer 1: ADMISSION (What enters memory?) — A-MAC
**Scope:** Individual agent memory
**Question:** Is this piece of information worth storing?
**Method:** Five-factor scoring (Utility, Confidence, Novelty, Recency, Type Prior)
**Key Properties:**
- Anti-hallucination gate (Confidence via ROUGE-L)
- Content-type aware filtering (Type Prior dominance)
- Efficient hybrid architecture (1 LLM call + rules)

### Layer 2: GOVERNANCE (Who accesses what?) — SSGM
**Scope:** Shared multi-agent memory
**Question:** Which agents can read/write which memories, and under what policies?
**Method:** Role-based access control with dynamic trust scoring
**Key Properties:**
- Cross-agent visibility management
- Policy-driven access tiers
- Consistency guarantees for shared state

### Layer 3: SECURITY (Is memory being attacked?) — MAScope
**Scope:** Cross-agent behavioral flows
**Question:** Are agents' memory operations part of an attack pattern?
**Method:** Dual-layer semantic flow reconstruction + trajectory scrutiny
**Key Properties:**
- Detects compound attacks spanning multiple agents/timesteps
- Intent consistency verification
- Control flow integrity checking

## The Integration Architecture

```
┌─────────────────────────────────────────────┐
│              LAYER 3: SECURITY              │
│     MAScope: Semantic Flow Monitoring       │
│  [Intent Check] [Data Flow] [Control Flow]  │
│         Monitors ALL interactions           │
├─────────────────────────────────────────────┤
│            LAYER 2: GOVERNANCE              │
│       SSGM: Shared Memory Policies          │
│  [Access Control] [Trust Scores] [Tiers]    │
│      Controls CROSS-AGENT memory ops        │
├─────────────────────────────────────────────┤
│            LAYER 1: ADMISSION               │
│      A-MAC: Individual Memory Filter        │
│  [Utility] [Confidence] [Novelty] [Type]    │
│      Filters INDIVIDUAL agent storage       │
├─────────────────────────────────────────────┤
│          AGENT RUNTIME (LLM + Tools)        │
└─────────────────────────────────────────────┘
```

## Five Key Integration Points

### 1. A-MAC's Confidence Score ↔ MAScope's Data Flow Check
**Connection:** Both verify that information is grounded in legitimate sources.
- A-MAC: Does this memory candidate have evidence in the conversation? (ROUGE-L)
- MAScope: Does this data flow from authorized sources to authorized destinations?
**Integration Opportunity:** Use A-MAC's Confidence score as a *pre-filter* for MAScope — low-confidence memories flagged before they enter the flow graph, reducing MAScope's analysis volume.

### 2. A-MAC's Type Prior ↔ SSGM's Access Tiers
**Connection:** Both recognize that information type determines handling policy.
- A-MAC: Preferences/identity → high Type Prior (always store)
- SSGM: Different access tiers for different content categories
**Integration Opportunity:** Unify the type classification system. A-MAC's Type Prior categories should map to SSGM's governance tiers:
- Stable facts (identity, preferences) → Tier 1: Broadly shared, persistent
- Task-specific knowledge → Tier 2: Team-scoped, session-persistent
- Transient states (emotions, greetings) → Tier 3: Private, ephemeral

### 3. MAScope's Intent Consistency ↔ Multi-Turn Failure Taxonomy
**Connection:** Intent drift is a recognized degradation mechanism.
- MAScope: Detects when behavioral path diverges from stated goal (security)
- Failure Taxonomy: Context drift and error cascades cause gradual goal divergence (reliability)
**Integration Opportunity:** MAScope's intent consistency check could be repurposed as a **reliability monitor** — not just detecting attacks, but detecting natural degradation. Same mechanism, different threat model.

### 4. A-MAC's Novelty Score ↔ Self-Locking Degradation
**Connection:** Both address the problem of redundant information reinforcement.
- A-MAC: Novelty score prevents storing memories that duplicate existing entries
- Self-Locking: Agents reinforce their own prior outputs, narrowing behavioral space
**Integration Opportunity:** Extended Novelty that also checks for *slight variations* of existing memories — preventing the "echo chamber" effect where multiple agents store slightly different versions of the same incorrect belief.

### 5. MAScope's Dual-Layer Observation ↔ Byzantine Fault Tolerance
**Connection:** Both address the trust verification problem.
- MAScope: Application layer + kernel layer provide independent verification channels
- Byzantine: Need f+1 agreements to tolerate f faults
**Integration Opportunity:** MAScope's kernel-level evidence provides an independent verification channel for agent claims — a "hardware attestation" layer that agents can't manipulate through prompt injection.

## The Memory Admission Security Problem

**A-MAC has a critical blind spot that MAScope can address:** A-MAC's five-factor scoring assumes that memory candidates come from legitimate conversations. It cannot detect:

1. **Adversarial Memory Injection:** A compromised agent crafts memories that score high on all five A-MAC factors (high utility, high confidence, novel, recent, right type) but contain subtly poisoned information.

2. **Gradual Belief Manipulation:** An adversary slowly introduces slightly modified facts across multiple interactions — each individually passes the Novelty check (sufficiently different from existing memories) but collectively shift the agent's knowledge base.

3. **Type Prior Gaming:** An adversary frames poisoned information as high-priority types (preferences, identity statements) to exploit the Type Prior dominance.

**MAScope's flow analysis can detect these by:**
- Tracing the provenance of memory candidates back through semantic flows
- Identifying when memory updates correlate with suspicious interaction patterns
- Flagging high-velocity memory changes from single sources

## The Surprising Convergence: Cheap Signals Win

Both A-MAC and MAScope independently discover that **simple, cheap signals are disproportionately powerful:**

| Paper | Cheap Signal | Expensive Signal | Cheap Signal Dominance |
|-------|-------------|-----------------|----------------------|
| A-MAC | Type Prior (14ms, -0.107 ΔF1) | LLM Utility (2580ms, -0.023 ΔF1) | 4.7× more important |
| MAScope | HSEC entity classification (rule-based, +27.5% F1) | Full flow reconstruction (LLM-based) | Enables the pipeline |

**Design Principle:** Invest in cheap, interpretable classification first; use expensive LLM reasoning only for what rules can't handle.

This maps to the Efficient Multi-Agent Coordination findings (2512.18337): tiered communication (cheap signals first, full exchange only when needed) achieves 3.2× speedup with only 2.7% quality loss.

## Unified Design Principles for Memory Governance

1. **Gate Early, Gate Cheap:** Type-based filtering before semantic analysis before LLM reasoning
2. **Verify Independently:** Dual-layer observation (MAScope), ROUGE-L grounding (A-MAC), trust scoring (SSGM)
3. **Classify Before Processing:** Content type determines handling policy at every layer
4. **Audit Everything:** Every admission, access, and flow should be reconstructable
5. **Precision Over Recall for Memory:** Better to miss a useful memory than to store a harmful one

## Open Questions

1. **What is the optimal interaction between layers?** Does Layer 3 (MAScope) override Layer 1 (A-MAC) decisions? Or advisory only?
2. **Latency budget:** Combined latency of all three layers? Can they run in parallel?
3. **Can this three-layer architecture prevent the 7 degradation mechanisms** identified in our Multi-Turn Failure Taxonomy?
4. **Scaling:** These papers evaluate on 5-10 agent systems. How does the three-layer architecture scale to 100+ agents?
5. **Dynamic adaptation:** Can the admission threshold and governance policies adapt based on MAScope's security observations?

## Testable Predictions

1. **Systems with A-MAC admission + SSGM governance will show 30-50% fewer error cascade failures** compared to store-everything approaches
2. **Type Prior classification will generalize across domains** — the "what kind of information is this?" question is more stable than "how useful is this information?"
3. **MAScope's flow analysis overhead will become the bottleneck** in large systems (>50 agents) due to O(n²) interaction pairs
4. **The three-layer architecture will reduce memory poisoning attacks by >80%** compared to any single-layer defense

## Relevance Score: 10/10
This synthesis identifies the first principled three-layer architecture for multi-agent memory governance. Each layer addresses a distinct failure mode. The integration points are specific and testable. The design principles (gate early, verify independently, classify before process) are immediately applicable.
