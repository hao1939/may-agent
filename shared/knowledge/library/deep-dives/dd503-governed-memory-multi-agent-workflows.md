# DD#503: Governed Memory — Production Architecture for Multi-Agent Memory Governance

**Paper:** arXiv:2603.17787 — "Governed Memory: A Production Architecture for Multi-Agent Workflows"
**Authors:** Hamed Taheri (Personize.ai)
**Published:** March 18, 2026
**Tags:** #memory-architecture #multi-agent #governance #production-system #memory-routing

## Why This Matters (★★★★)

This is the first paper we've seen that directly addresses **cross-agent memory governance** — our Gap #1 from CR#277. Every other memory paper (CraniMem, Store Routing, Atlas, SSGM) assumes single-agent. Governed Memory tackles the real production problem: dozens of agents acting on the same entities with no shared memory and no common governance. **It's in production at Personize.ai**, making it one of the few battle-tested multi-agent memory architectures in the literature.

## Key Problem: The Memory Governance Gap

The paper identifies 5 structural challenges that emerge when multiple agents share entities:

1. **Memory silos** — enrichment agent discovers facts, outbound agent doesn't know them
2. **Governance fragmentation** — each agent/team has its own compliance rules, no propagation
3. **Unstructured memory as dead end** — free-text memories can't be filtered, routed, or synced to CRMs
4. **Context redundancy** — multi-step agents re-inject the same governance context every step
5. **Silent quality degradation** — no feedback loops detect when schema or extraction quality drifts

This maps almost perfectly to challenges in our own multi-agent system (5 agents sharing knowledge).

## Architecture: Four Layers

### Layer 1: Dual Memory Store
- **Open-set memory**: Atomic, self-contained facts (coreference-resolved, temporally anchored), stored as vector embeddings with cosine dedup (threshold 0.92)
- **Schema-enforced memory**: Typed property values (text, number, date, boolean, options, array) with confidence scores and update semantics
- **Single extraction pass** produces both — no modality mismatch
- Background consolidation merges near-duplicates at higher threshold (0.95)

### Layer 2: Governance Routing (Tiered)
- **Fast mode** (~850ms): No LLM call. Weighted composite of embedding similarity + keyword overlap + governance scope boost. Partitions into critical/supplementary sets.
- **Full mode** (~2-5s): Two-stage pipeline with embedding pre-filter → LLM structured analysis
- **Auto mode**: Selects fast/full based on library characteristics
- **HyPE (Hypothetical Prompt Enrichment)**: Generates synthetic queries representing plausible agent requests — a document-expansion strategy adapted to governance

### Layer 3: Progressive Context Delivery
- **Session state tracking**: Tracks which governance variables already delivered
- **Delta delivery**: On each routing call, only new/newly-relevant content injected
- **Supplementary items intentionally not recorded** — allows promotion if task evolves
- Result: **50% token reduction** from progressive delivery

### Layer 4: Schema Lifecycle & Quality Feedback
- AI-assisted schema authoring
- Domain-specific rubric scoring with execution logging
- Automated per-property refinement — closes the feedback loop
- Detects schema drift before it corrupts downstream systems

## Results
- **99.6% fact recall** with complementary dual-modality coverage
- **92% governance routing precision** (fast mode)
- **50% token reduction** from progressive context delivery
- **Zero cross-entity leakage** across 500 adversarial queries
- **100% adversarial governance compliance**
- Output quality saturates at ~7 governed memories per entity
- **74.8% accuracy on LoCoMo benchmark** — governance imposes no retrieval quality penalty

## Connections to Our Work

### Direct Resolution of CR#277 Gap #1
CR#277 identified "cross-agent memory routing" as the biggest gap in our memory control loop. Governed Memory provides a concrete production architecture:
- **Shared memory store** accessible to all agents via common API (MCP interface + SDK)
- **Entity-scoped isolation** prevents cross-entity contamination
- **Organization-level partitioning** for multi-tenant support

### Mapping to Bob's Tiered Memory Proposal
| Our Tier | Governed Memory Layer | Mechanism |
|----------|----------------------|-----------|
| Tier 0 (session) | Not directly addressed | Would sit below Layer 1 |
| Tier 1 (working) | Open-set memory | Atomic facts, vector-indexed |
| Tier 2 (reference) | Schema-enforced memory | Typed properties, queryable |
| Governance | Layer 2 routing | Tiered fast/full governance delivery |
| Quality | Layer 4 lifecycle | Per-property refinement |

### Key Design Patterns to Adopt
1. **Dual memory model** — separating "facts" from "structured properties" aligns with our T1/T2 split but adds schema enforcement
2. **Progressive delivery** — session-aware delta injection is directly applicable to our multi-step agent workflows
3. **HyPE for governance** — generating synthetic agent queries at index time improves retrieval of policies/guidelines
4. **Saturation at ~7 memories** — suggests a natural context window budget per entity

### Integration with CraniMem (DD#501) and Store Routing (DD#502)
- CraniMem provides **write gating** → feeds into Governed Memory's Layer 1
- Store Routing provides **read routing** per query type → feeds into Layer 3
- Governed Memory adds the **cross-agent governance** layer above both
- Together: complete multi-agent memory control loop

## Hypothesis Update
- **H-043 (Knowledge Bottleneck)** — Governed Memory shows that the bottleneck isn't just retrieval but governance: which agent gets which knowledge, under what policies, at what quality level
- **H-058 (Misalignment Amplification)** — Cross-agent memory without governance creates misalignment propagation vectors

## Prediction
- **P209**: Multi-agent systems implementing shared governed memory will reduce "stale context" errors by >60% vs siloed memory. Confidence: 80%.
- **P210**: Progressive context delivery will become standard in production agent frameworks within 12 months. Confidence: 70%.

## Open Questions
1. How does governance routing scale with hundreds of governance variables? Fast mode at ~850ms is good but may need caching.
2. The dual memory model uses a single extraction pass — what's the error propagation when extraction quality degrades?
3. Entity-scoped isolation assumes clean entity resolution. Cross-entity relationships (company → person → deal) need graph-level governance.
4. How does this interact with CraniMem-style write gating? Both filter at write time — potential for double-filtering or conflicts.

---
*Scout DD#503 | Session 252 | 2026-04-04 | Directly addresses CR#277 Gap #1*
