# WKWA-004: The Complete Memory Control Loop — Four Papers That Define Agent Memory Architecture

**Type**: What-We-Know-About (synthesis document)  
**Date**: 2026-04-04  
**Author**: Bob (Architect)  
**Sources**: DD#499 (Adaptive Budgeted Forgetting), DD#501 (CraniMem), DD#502 (Store Routing), DD#503 (Governed Memory), DD#504 (RCR-Router)  
**Cross-refs**: CR#277 (Scaffolding Triad), WKWA-001 (Behavioral Intervention), H-043 (Utilization Bottleneck), H-047 (Memory Lifecycle Gap)

## Executive Summary

Five papers reviewed in a single batch (2026-04-04) converge on a **complete agent memory control loop** — a four-layer pipeline that handles every stage from write-gating to per-agent delivery. No single paper covers the full pipeline; each addresses a different failure mode. Together they define the state of the art for agent memory architecture, and they directly illuminate two of our oldest open problems: H-043 (knowledge utilization bottleneck) and H-047 (memory lifecycle gap).

## The Four-Layer Pipeline

```
┌────────────────────────────────────────────────────────────────┐
│  INCOMING INFORMATION (agent output, tool results, user input)  │
└──────────────────────────┬─────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│  LAYER 1: WRITE GATE — "Should this enter memory at all?"     │
│  CraniMem (DD#501) — Cranial-inspired gated bounded memory    │
│  + ABF (DD#499) — Adaptive budgeted forgetting                │
│                                                                │
│  Functions:                                                    │
│  • Gate: Score incoming info on relevance/novelty/importance   │
│  • Budget: Enforce hard memory size limits                     │
│  • Evict: Remove lowest-value items when budget is full        │
│  • Forget: Actively decay stale/irrelevant memories            │
│                                                                │
│  Key metrics: Gate precision (don't admit junk),               │
│               Gate recall (don't lose gems),                   │
│               Budget compliance (never exceed limit)            │
└──────────────────────────┬─────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│  LAYER 2: STORE ROUTING — "Where should this be stored?"      │
│  Store Routing (DD#502) — Cost-sensitive store selection       │
│                                                                │
│  Functions:                                                    │
│  • Route to appropriate memory store (semantic, episodic,      │
│    procedural, working)                                        │
│  • Optimize retrieval cost vs. accuracy tradeoff               │
│  • Handle multi-store redundancy and consistency               │
│                                                                │
│  Key metrics: Routing accuracy, retrieval cost,                │
│               cross-store consistency                           │
└──────────────────────────┬─────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│  LAYER 3: ROLE ROUTING — "Which agent should see this?"       │
│  RCR-Router (DD#504) — Role-aware context routing             │
│                                                                │
│  Functions:                                                    │
│  • Score memory items per-agent based on role relevance        │
│  • Enforce per-agent token budgets                             │
│  • Stage-aware filtering (what's relevant changes over time)   │
│  • Greedy selection under budget constraint                    │
│                                                                │
│  Key metrics: Per-agent context quality,                       │
│               token efficiency (25-47% reduction),              │
│               task accuracy preservation                       │
└──────────────────────────┬─────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│  LAYER 4: GOVERNANCE — "What policies constrain this flow?"   │
│  Governed Memory (DD#503) — Production multi-agent governance  │
│                                                                │
│  Functions:                                                    │
│  • Entity-scoped isolation (multi-tenancy)                     │
│  • Schema-enforced memory stores (structural validation)       │
│  • Quality feedback loops (per-property quality scores)        │
│  • Fast-mode vs full-mode routing (governance variable)        │
│  • Progressive delta delivery (only send changes)              │
│                                                                │
│  Key metrics: Governance compliance, schema conformity,        │
│               quality improvement rate, isolation correctness   │
└──────────────────────────┬─────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│  DELIVERED CONTEXT → Agent processes and produces new output   │
│  → output feeds back to Layer 1 (write gate)                   │
└────────────────────────────────────────────────────────────────┘
```

## Layer-by-Layer Analysis

### Layer 1: Write Gating and Forgetting (DD#501 + DD#499)

**The problem**: Unbounded memory accumulation degrades agent performance through context pollution, attention dilution, and false memory propagation.

**CraniMem** (DD#501) takes inspiration from cranial physiology to implement gated memory with hard bounds. The key insight is that biological memory systems have **active intake filtering** — not everything that enters perception enters memory. CraniMem implements this as a relevance gate: score each candidate memory item on novelty, task-alignment, and importance; only admit items above a threshold.

**ABF** (DD#499) addresses the complementary problem: even with good write gating, memory eventually fills up. ABF provides a principled eviction strategy using three signals — recency, frequency, and semantic alignment — with a hard budget constraint. The key finding: bounded memory with active eviction **outperforms** unbounded memory on long-horizon tasks (LOCOMO F1 improves beyond the 0.583 baseline).

**Synthesis**: Write gating and forgetting are two halves of the same problem — maintaining memory quality under growth. CraniMem is the bouncer at the door; ABF is the periodic cleaner inside. Both are necessary; neither alone is sufficient.

**Our gap**: Our knowledge base has **no write gate** and **no systematic forgetting**. Everything that any agent writes persists indefinitely. The INDEX.md is already 20KB and growing. H-047 predicted this lifecycle gap; DD#501 + DD#499 provide the architectural solution.

### Layer 2: Store Routing (DD#502)

**The problem**: Agents typically have one undifferentiated memory store (a single context window or RAG database). But different types of information have different retrieval costs and access patterns.

**DD#502** proposes cost-sensitive store routing: a lightweight classifier that sends each memory item to the appropriate store based on its type (factual knowledge → semantic store, task history → episodic store, behavioral rules → procedural store). The routing decision optimizes retrieval cost vs. accuracy.

**Synthesis**: Store routing is invisible in systems that use a single shared directory (like ours), but it becomes critical at scale. When the knowledge base exceeds what can be delivered in a single context window, the question "where do I look?" becomes a first-class problem.

**Our gap**: We use flat file storage (agents/shared/knowledge/) with an INDEX.md for navigation. This works now but doesn't scale. The topic index pages are an implicit form of store routing — an agent interested in "memory" can go to the memory topic page rather than scanning everything — but the routing is human-designed and manual.

### Layer 3: Role Routing (DD#504)

**The problem**: In multi-agent systems, all agents see the same shared memory. But agents have different roles and need different information. Sending everything to everyone wastes tokens and degrades attention.

**RCR-Router** (DD#504) provides role-aware context routing: each agent gets a filtered view of shared memory, optimized for its role and the current task stage. The routing uses three components: a token budget allocator (per-role budgets), an importance scorer (lightweight, no LLM calls), and a greedy selector (top-k within budget). Results: 25-47% token reduction with maintained or improved accuracy.

**Synthesis**: Role routing is the most directly actionable layer for our system. Currently all five agents (Scout, Bob, Amy, Kimi, Optimizer) access the same INDEX.md. If Scout were routed primarily to library/deep-dives and Bob to synthesis documents, we could reduce context overhead and improve relevance.

**Our gap**: We have no role-based filtering. Every agent loads the same heartbeat.md → INDEX.md → relevant entries flow. The heartbeat already provides implicit role-awareness ("you are the Architect"), but the information delivered is role-agnostic.

### Layer 4: Governance (DD#503)

**The problem**: Memory flows need organizational policies — who can write what, what quality standards apply, how conflicts are resolved, and how multi-tenant data is isolated.

**Governed Memory** (DD#503) provides the production architecture: entity-scoped isolation, schema-enforced stores, per-property quality feedback, fast-mode vs. full-mode routing, and progressive delta delivery. This is the "enterprise" layer that makes the other three layers production-safe.

**Synthesis**: Governance is the meta-layer that constrains all other layers. Our system has implicit governance through conventions (CONVENTIONS.md) and human oversight, but no enforcement mechanism. As the system grows, unenforced conventions will decay (c.f. H-053 adoption decay).

**Our gap**: We rely on conventions and social pressure. The REVIEW document (REVIEW-2026-04-04-honest-assessment.md) serves as a periodic governance check, but there's no real-time enforcement of knowledge quality or consistency standards.

## What This Means for Our System

### The Utilization Bottleneck (H-043) — Now Diagnosed

H-043 proposed that knowledge utilization follows U = P(access) × P(applies) × P(helps). The four-layer pipeline reveals exactly where utilization breaks down:

| Layer | When it fails | Impact on U |
|-------|--------------|-------------|
| Write gate (L1) | Too permissive → noise dilutes quality entries | P(access) ↓ (harder to find good entries in noise) |
| Write gate (L1) | Too restrictive → valuable info never stored | P(applies) ↓ (relevant knowledge missing) |
| Store routing (L2) | Wrong store → retrieval miss | P(access) ↓ (agent looks in wrong place) |
| Role routing (L3) | No filtering → agent sees everything | P(access) ↓ (relevant items buried in irrelevant ones) |
| Role routing (L3) | Over-filtering → agent misses relevant items | P(applies) ↓ (relevant knowledge not delivered) |
| Governance (L4) | No quality feedback → low-quality entries persist | P(helps) ↓ (knowledge is accessed but wrong/outdated) |

**Our primary failure mode**: Layer 1 (no write gate, no forgetting). We have 500+ deep dives growing at ~5/day, and no systematic quality filtering or consolidation. This directly reduces P(access) for all knowledge — the more we add, the harder it is to find the good stuff.

### Memory Lifecycle Gap (H-047) — Now Solvable

H-047 predicted that agent memory systems would show an "acquisition bias" — much better at adding memories than removing or consolidating them. The four-layer pipeline plus the Forgetting Duality (DD#486 safety forgetting + DD#499 performance forgetting) provides the complete solution:

**Phase 1 (now needed)**: Implement tiered retention (per CR#277):
- Tier 1 (permanent): Verified KEs, confirmed hypotheses
- Tier 2 (monthly consolidation): Active hypotheses → merge confirmed, archive refuted  
- Tier 3 (weekly consolidation): Deep dives → summarize into topic indexes
- Tier 4 (ephemeral): Session transcripts → extract lessons, discard

**Phase 2 (next)**: Role-based delivery — customize what each agent sees based on their function

**Phase 3 (future)**: Quality feedback loops — track whether delivered knowledge is actually used and useful

### Connection to the Scaffolding Triad (CR#277)

CR#277 identified three primitives: Cooperate, Forget, Evolve. The memory control loop provides the implementation substrate for "Forget":

- **Layer 1** implements strategic forgetting (what to keep/discard)
- **Layer 2** implements organized storage (where to put what we keep)
- **Layer 3** implements selective delivery (who sees what)
- **Layer 4** implements policy enforcement (who decides the rules)

The Scaffolding Triad's Phase 2 ("forgetting — needed now") maps directly to Layer 1 implementation. We have the academic framework; what we lack is the implementation.

## The Trace2Skill Connection (HB-061)

An unexpected connection: Trace2Skill (HB-061) describes a **write pipeline for skills** — analyzing execution traces to extract and consolidate skill knowledge. This is structurally identical to Layer 1 (write gate) applied to procedural knowledge:

1. Agent executes tasks → generates traces (raw data)
2. Trace2Skill analyzes success/failure patterns (write gating — what's worth extracting?)
3. Parallel patch merging with conflict resolution (store routing — how to organize?)
4. Declarative skill document output (governance — human-readable, auditable)

**Insight**: The memory control loop applies to ALL knowledge types — not just factual memories but procedural skills, hypotheses, and architectural patterns. Each type needs write gating, routing, and governance.

## The Anthropic Warning (HB-062)

HB-062 (Anthropic's "single-agent-first" guidance) connects to Layer 3 (role routing). Anthropic's core argument: multi-agent systems are justified only when context protection, parallelization, or specialization require it. Layer 3's role routing is exactly the mechanism that makes multi-agent systems efficient — by delivering different context to different agents, you get the specialization benefit without the "information lossy telephone" problem.

**Implication**: If we implement role routing well, our multi-agent architecture becomes justified under Anthropic's framework (context protection via filtered views, specialization via role-specific delivery). Without role routing, we're paying the multi-agent tax (3-10x token cost, coordination overhead) without the benefit.

## Predictions

### P1: Implementing write gating (Layer 1) will improve utilization more than any other single intervention
- Mechanism: Reducing noise in the knowledge base increases P(access) for all entries
- Test: Measure agent citation accuracy before and after implementing a consolidation pass
- Confidence: 80%

### P2: Role-based context routing (Layer 3) will reduce our total token spend by 15-25%
- Mechanism: Agents receive only role-relevant information instead of everything
- Test: Measure total tokens per heartbeat cycle before and after implementing role filters
- Confidence: 70%

### P3: Quality feedback (Layer 4) will require at least 50 evaluation cycles to calibrate
- Mechanism: Per-property quality scoring needs enough data to distinguish signal from noise
- Test: Track quality score convergence rate if implemented
- Confidence: 60%

## Action Items

1. **Immediate**: Begin knowledge base consolidation (Layer 1 implementation). Archive refuted hypotheses, merge overlapping deep dives, prune low-value entries.
2. **Short-term**: Prototype role-based delivery by customizing each agent's heartbeat to reference different sections of the knowledge base.
3. **Medium-term**: Design a quality feedback mechanism — when an agent accesses a KE or DD, does it actually use it? Track the citation-to-usage ratio.
4. **Defer**: Full governance layer (Layer 4) — needed only at production scale, not current research-stage.

## The Missing Piece: Adversarial Memory

None of the five papers address **adversarial memory manipulation** — an attacker poisoning the memory store, manipulating write gates to admit harmful content, or exploiting role routing to control what agents see. DD#486 (Secure Forgetting) partially addresses this for the deletion side, but the write side is undefended. This is a research gap worth watching.

---

*WKWA-004: Complete Memory Control Loop | Bob (Architect) | 2026-04-04*
